# PyDataAnalyze 前后端接口契约

本文档是前后端交互的**唯一事实来源**。所有 API 端点、请求/响应格式、数据类型均在此定义。  
`docs/` 目录下的旧规约文档在本文档生效后废止。

---

## 1. 通用约定

### 1.1 基础信息

| 项 | 值 |
|----|-----|
| 协议 | HTTP/1.1 |
| 基础路径 | `/api` |
| 开发环境后端地址 | `http://localhost:8000` |
| 开发环境前端地址 | `http://localhost:5173` |
| 成功响应 Content-Type | `application/json`（导出接口返回文件流除外） |
| 字符编码 | UTF-8 |

### 1.2 成功响应格式

除导出接口返回文件流外，所有成功响应均为 **HTTP 200**，响应体为 JSON。

- 端点只返回一个数据对象时，直接返回该对象本身（例如 `/api/chart` 返回 `ChartData`）。
- 端点返回多个字段时，各字段平级排列，不引入外层包装。

### 1.3 错误响应格式

使用对应的 HTTP 状态码，响应体为：

```json
{ "error": "人类可读的错误描述" }
```

| 状态码 | 语义 |
|--------|------|
| 400 | 请求参数不合法 |
| 404 | session 不存在或已过期 |
| 413 | 上传文件过大 |
| 500 | 服务器内部错误 |

### 1.4 会话管理

- 上传文件后后端生成 `session_id`（UUID hex 字符串，无连字符），后续所有操作携带此 ID。
- 会话数据持久化到磁盘，服务器重启不丢失。
- 无自动过期机制。

---

## 2. 共享数据类型

### 2.1 ColumnInfo

```json
{ "name": "Age", "dtype": "int64" }
```

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 列名 |
| dtype | string | pandas dtype 字符串 |

### 2.2 ChartData

图表数据对象（详见第 4 节）。

---

## 3. API 端点

### 3.1 文件上传 —— `POST /api/upload`

**请求**：
- Content-Type: `multipart/form-data`
- 字段：`file` — 支持格式：CSV、Excel（`.xlsx`, `.xls`）、JSON（`.json`）、JSON Lines（`.jsonl`）、Parquet（`.parquet`）、Feather（`.feather`）、ZIP（`.zip`，内含单个支持的表格文件）。
- 文件大小上限：**10 MB**。

**处理逻辑**：
1. 校验扩展名，不支持的返回 400。
2. 根据扩展名选择解析器读取为 DataFrame。
3. 生成 `session_id`，持久化 DataFrame，提取前 20 行预览，记录到数据库。

**成功响应**：同原协议，返回 `session_id`, `filename`, `rows`, `cols`, `columns`, `preview`。

### 3.2 数据清洗 —— `POST /api/clean`

无变化，同原协议。

### 3.3 图表数据 —— `POST /api/chart`

**请求**：

```json
{
  "session_id": "a1b2c3d4e5f6",
  "chart_type": "scatter",   // 扩展为: histogram | scatter | box | bar | pie | line | heatmap | scatter_matrix
  "x_column": "Income",      // histogram / scatter / bar / pie / line 时使用
  "y_column": "SpendingScore", // scatter / bar / line 时使用
  "columns": ["Age", "Income"], // box / heatmap / scatter_matrix 时使用
  "color_column": "cluster"    // 可选，用于 scatter / scatter_matrix 着色
}
```

**处理逻辑**：
- **pie**：对 `x_column` 统计频次，返回 `{ label, value }` 数组，结构与 bar 相同。
- **line**：与 scatter 数据结构相同，但后端会按 x_column 排序。
- **heatmap**：对 `columns` 中的所有数值列计算相关性矩阵，返回 `{ x, y, value }` 三元组。
- **scatter_matrix**：对 `columns` 中的列两两组合，返回多组散点数据（`panels` 数组，每个元素包含 `x_col, y_col, data: ScatterDatum[]`）。

**成功响应**：直接返回 `ChartData` 对象（见第 4 节扩展类型）。

### 3.4 聚类/降维分析 —— `POST /api/analyze`

**请求**：

```json
{
  "session_id": "a1b2c3d4e5f6",
  "method": "kmeans",        // kmeans | dbscan | agglomerative | pca
  "columns": ["Income", "SpendingScore"],
  "params": {
    "n_clusters": 3,         // kmeans / agglomerative 时有效
    "eps": 0.5,              // dbscan 时有效
    "min_samples": 5,        // dbscan 时有效
    "n_components": 2        // pca 时有效
  },
  "plot_x": "Income",        // 可选，默认 columns[0]
  "plot_y": "SpendingScore"  // 可选，默认 columns[1]
}
```

**处理逻辑**：
1. 校验列存在且为数值型。
2. 根据 `method` 调用相应算法。
3. 生成带簇/成分标签的 DataFrame（PCA 生成 PC1, PC2 等列）。
4. 记录分析到数据库。
5. 返回结果，包含图表数据、评估指标。

**成功响应**（以 kmeans 为例）：

```json
{
  "method": "kmeans",
  "inertia": 1234.56,
  "columns": [ ... ],
  "chart_data": { "chart_type": "cluster_scatter", ... },
  "centers": [ [55.0,48.0], ... ],
  "summary": { ... },
  "metrics": {
    "silhouette_score": 0.42,
    "calinski_harabasz_score": 185.3
  }
}
```

- `metrics` 包含对应算法的评估指标（聚类：轮廓系数、CH 指数；PCA：解释方差比例）。
- 对于 `dbscan`，返回的 `chart_data` 中 `cluster` 可能为 -1（噪声）。

### 3.5 多算法对比 —— `POST /api/analyze/compare`

**请求**：

```json
{
  "session_id": "a1b2c3d4e5f6",
  "columns": ["Income", "SpendingScore"],
  "methods": [
    { "type": "kmeans", "params": { "n_clusters": 3 } },
    { "type": "dbscan", "params": { "eps": 0.5, "min_samples": 5 } },
    { "type": "agglomerative", "params": { "n_clusters": 3 } }
  ]
}
```

**响应**：返回一个数组，每个元素为单个算法的分析结果（结构与 `/api/analyze` 单个响应一致）。

```json
{
  "results": [
    { "method": "kmeans", "chart_data": ..., "metrics": {...}, ... },
    { "method": "dbscan", "chart_data": ..., "metrics": {...}, ... },
    ...
  ]
}
```

### 3.6 数据导出 —— `POST /api/export`

无变化，同原协议。

### 3.7 健康检查 —— `GET /api/health`

无变化。

### 3.8 历史记录列表 —— `GET /api/history`

**请求**：无参数（支持可选分页 `?limit=20&offset=0`，当前版本返回所有记录）。

**处理逻辑**：查询 `uploads` 和 `analysis_history` 表，降序排列。

**成功响应**：

```json
{
  "uploads": [
    {
      "id": 1,
      "session_id": "a1b2c3d4e5f6",
      "filename": "sales_data.csv",
      "upload_time": "2026-06-04T10:30:00",
      "rows": 1000,
      "cols": 5
    }
  ],
  "analyses": [
    {
      "id": 1,
      "session_id": "a1b2c3d4e5f6",
      "method": "kmeans",
      "params_json": "{\"features\":[\"Income\"],\"n_clusters\":3}",
      "inertia": 1234.56,
      "created_at": "2026-06-04T10:35:00"
    }
  ]
}
```

### 3.9 加载历史会话 —— `GET /api/session/{session_id}`

无变化，返回当前会话数据预览。

---

## 4. 图表数据格式规范

在原有五种类型基础上，增加 `pie`, `line`, `heatmap`, `scatter_matrix`。

### 4.1 ChartData 扩展类型

```typescript
type ChartData =
  | { chart_type: "histogram"; data: HistogramDatum[]; x_label?; y_label?; title? }
  | { chart_type: "scatter"; data: ScatterDatum[]; x_label?; y_label?; title? }
  | { chart_type: "box"; data: BoxDatum[]; x_label?; y_label?; title? }
  | { chart_type: "bar"; data: BarDatum[]; x_label?; y_label?; title? }
  | { chart_type: "cluster_scatter"; data: ClusterScatterDatum[]; x_label?; y_label?; title? }
  | { chart_type: "pie"; data: PieDatum[]; title? }
  | { chart_type: "line"; data: ScatterDatum[]; x_label?; y_label?; title? }
  | { chart_type: "heatmap"; data: HeatmapDatum[]; x_label?; y_label?; title? }
  | { chart_type: "scatter_matrix"; panels: ScatterPanel[]; title? };
```

### 4.2 新增数据点形状

**PieDatum**
```json
{ "label": "类别A", "value": 150 }
```

**HeatmapDatum**
```json
{ "x": "Age", "y": "Income", "value": 0.85 }
```

**ScatterPanel**（散点矩阵的一个子图）
```json
{
  "x_col": "Age",
  "y_col": "Income",
  "data": [ { "x": 25, "y": 50000 } ]
}
```

- 散点矩阵的子图数据统一用 `ScatterDatum` 结构，如需着色可使用 `color_column` 字段，数据元素会增加 `color` 属性（当 `color_column` 指定时）。具体可在 `ClusterScatterDatum` 基础上扩展或使用统一 `ExtendedScatterDatum`。为简化，前端可约定：若 `ChartData` 的 `color_field` 字段存在，则散点数据中包含同名字段。

### 4.3 设计原则不变

- 后端做计算，前端做渲染。
- 对象数组优于并行数组。
- 库无关。


---

## 5. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-04 | 1.0 | 初始版本，统一前后端契约，废止 docs/ 下的旧 SPEC 文档 |
| 2026-06-05 | 1.1 | 增加文件格式支持（JSON/Parquet/Feather/ZIP）；扩展图表类型（pie/line/heatmap/scatter_matrix）；分析功能增加 PCA/DBSCAN/Agglomerative 及评估指标，新增 `/api/analyze/compare` 端点；历史记录已集成数据库，无需用户系统 |

