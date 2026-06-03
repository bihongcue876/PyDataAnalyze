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

除导出接口（§3.5）返回文件流外，所有成功响应均返回 **HTTP 200**，响应体为 JSON。

不使用 `{success, data}` 冗余包装——HTTP 状态码已表达成功/失败语义。具体而言：

- 端点**只返回一个数据对象**时，直接返回该对象本身。例如 `/api/chart` 返回 `ChartData`：
  ```json
  { "chart_type": "scatter", "data": [...], "x_label": "Income" }
  ```
- 端点**返回多个字段**时，各字段平级排列，不引入外层包装。例如 `/api/analyze`：
  ```json
  { "inertia": 1234.56, "chart_data": {...}, "centers": [...] }
  ```

> **设计理由**：HTTP 状态码已表达成功/失败语义，额外包装增加前端解析复杂度且不提供新信息。

### 1.3 错误响应格式

所有错误响应使用对应的 **HTTP 状态码（4xx/5xx）**，响应体为：

```json
{
  "error": "人类可读的错误描述"
}
```

| 状态码 | 语义 |
|--------|------|
| 400 | 请求参数不合法（列名不存在、文件格式错误等） |
| 404 | session 不存在或已过期 |
| 413 | 上传文件过大 |
| 500 | 服务器内部错误 |

### 1.4 会话管理

- 上传文件后后端生成 `session_id`（UUID hex 字符串，无连字符），后续所有操作携带此 ID。
- 会话数据持久化到磁盘，服务器重启不丢失。
- 无自动过期机制（简化处理）。

---

## 2. 共享数据类型

### 2.1 ColumnInfo

列描述对象：

```json
{
  "name": "Age",
  "dtype": "int64"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 列名 |
| `dtype` | string | pandas dtype 字符串，如 `"int64"`, `"float64"`, `"object"` |

> **设计理由**：前端需要 dtype 区分数值列与分类列——聚类只能选数值列，饼图/柱状图需要分类列做分组。

### 2.2 ChartData

图表数据对象（详见第 4 节）。

---

## 3. API 端点

### 3.1 文件上传 —— `POST /api/upload`

**请求**：
- Content-Type: `multipart/form-data`
- 字段：`file` — CSV（`.csv`）或 Excel（`.xlsx`, `.xls`）文件
- 文件大小上限：**10 MB**，超过返回 413

**处理逻辑**：
1. 校验文件扩展名，不支持的类型返回 400
2. 使用 pandas 读取为 DataFrame
3. 生成 `session_id`（`uuid.uuid4().hex`）
4. 持久化 DataFrame 到磁盘
5. 提取前 20 行作为预览数据
6. 记录到数据库

**成功响应**：

```json
{
  "session_id": "a1b2c3d4e5f6",
  "filename": "sales_data.csv",
  "rows": 1000,
  "cols": 5,
  "columns": [
    {"name": "Age", "dtype": "int64"},
    {"name": "Income", "dtype": "float64"},
    {"name": "Gender", "dtype": "object"}
  ],
  "preview": [
    {"Age": 25, "Income": 50000.0, "Gender": "Male"},
    {"Age": 30, "Income": 62000.0, "Gender": "Female"}
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `session_id` | string | 会话标识，后续操作必须携带 |
| `filename` | string | 原始文件名 |
| `rows` | integer | 总行数 |
| `cols` | integer | 总列数 |
| `columns` | ColumnInfo[] | 列信息数组 |
| `preview` | object[] | 前 20 行数据，对象数组；NaN 以 `null` 表示 |

---

### 3.2 数据清洗 —— `POST /api/clean`

**请求**：Content-Type: `application/json`

```json
{
  "session_id": "a1b2c3d4e5f6",
  "fill_missing": true,
  "fill_strategy": "mean",
  "remove_outliers": false,
  "outlier_columns": [],
  "outlier_method": "iqr",
  "drop_duplicates": true
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `session_id` | string | 是 | — | 会话 ID |
| `fill_missing` | boolean | 是 | — | 是否填充缺失值 |
| `fill_strategy` | string | 否 | `"mean"` | 填充策略：`"mean"` / `"median"` / `"mode"` / `"drop"` |
| `remove_outliers` | boolean | 是 | — | 是否移除异常值 |
| `outlier_columns` | string[] | 否 | `[]` | 检测异常值的列名列表（仅 `remove_outliers=true` 时有效；空数组 = 对所有数值列检测） |
| `outlier_method` | string | 否 | `"iqr"` | 检测方法：`"iqr"` / `"zscore"` |
| `drop_duplicates` | boolean | 是 | — | 是否删除重复行 |

> **设计理由**：清洗操作各自独立开关，用户可以自由组合——比如只去重不填缺失。粒度比单一策略字符串更灵活。

**处理逻辑**：
1. 校验 `session_id` 有效性
2. 按参数顺序执行清洗操作（填充 → 去异常 → 去重）
3. 覆盖保存清洗后的 DataFrame
4. 记录操作到数据库

**成功响应**：

```json
{
  "operations": ["缺失值填充(mean)", "重复值删除"],
  "rows": 980,
  "cols": 5,
  "columns": [
    {"name": "Age", "dtype": "int64"},
    {"name": "Income", "dtype": "float64"}
  ],
  "preview": [
    {"Age": 25, "Income": 50000.0}
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `operations` | string[] | 实际执行的操作列表（面向用户展示） |
| `rows` | integer | 清洗后总行数 |
| `cols` | integer | 清洗后总列数 |
| `columns` | ColumnInfo[] | 清洗后列信息 |
| `preview` | object[] | 清洗后前 20 行预览；NaN 以 `null` 表示 |

---

### 3.3 图表数据 —— `POST /api/chart`

**请求**：Content-Type: `application/json`

```json
{
  "session_id": "a1b2c3d4e5f6",
  "chart_type": "scatter",
  "x_column": "Income",
  "y_column": "SpendingScore"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `session_id` | string | 是 | — | 会话 ID |
| `chart_type` | string | 是 | — | `"histogram"` / `"scatter"` / `"box"` / `"bar"` |
| `x_column` | string | 条件必填 | — | X 轴 / 分类列名；histogram / scatter / bar 时必填 |
| `y_column` | string | 否 | `null` | Y 轴数值列名；scatter 必填，bar 可选 |
| `columns` | string[] | 条件必填 | `null` | box 时使用：并排展示的多列名；替代 `x_column` |

**处理逻辑**：
1. 校验列存在
2. 散点图：必须提供 `y_column`
3. 柱状图：若提供 `y_column` 则对 x_column 分组后聚合 y_column（取均值）；否则统计 x_column 频次
4. 直方图：对 `x_column` 数值列分箱
5. 箱线图：对 `columns` 中每一列计算五数概括，返回多条 `BoxDatum`
6. 返回统一的 `ChartData` 对象（见第 4 节）

**成功响应**——直接返回 `ChartData` 对象（无包装键）：

```json
{
  "chart_type": "scatter",
  "data": [
    {"x": 34.0, "y": 50.0},
    {"x": 23.0, "y": 78.0}
  ],
  "x_label": "Income",
  "y_label": "SpendingScore",
  "title": "Income vs SpendingScore"
}
```

---

### 3.4 聚类分析 —— `POST /api/analyze`

**请求**：Content-Type: `application/json`

```json
{
  "session_id": "a1b2c3d4e5f6",
  "columns": ["Income", "SpendingScore", "Age"],
  "n_clusters": 3,
  "plot_x": "Income",
  "plot_y": "SpendingScore"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `session_id` | string | 是 | — | 会话 ID |
| `columns` | string[] | 是 | — | 参与聚类的数值列名（至少 2 列） |
| `n_clusters` | integer | 否 | `3` | 聚类数（范围 [2, 10]） |
| `plot_x` | string | 否 | `columns[0]` | 散点图 X 轴列名（**必须**在 `columns` 中） |
| `plot_y` | string | 否 | `columns[1]` | 散点图 Y 轴列名（**必须**在 `columns` 中） |

**处理逻辑**：
1. 校验列存在且为数值型
2. 标准化 → K-Means → 反标准化中心点
3. 使用 `plot_x` / `plot_y` 指定的两列生成聚类散点图数据（带 `cluster` 字段区分颜色）
4. 记录分析到数据库

**成功响应**：

```json
{
  "inertia": 1234.56,
  "n_clusters": 3,
  "columns": [
    {"name": "Income", "dtype": "float64"},
    {"name": "SpendingScore", "dtype": "float64"},
    {"name": "Age", "dtype": "int64"},
    {"name": "cluster", "dtype": "int64"}
  ],
  "chart_data": {
    "chart_type": "cluster_scatter",
    "data": [
      {"x": 34.0, "y": 50.0, "cluster": 0},
      {"x": 23.0, "y": 78.0, "cluster": 1}
    ],
    "x_label": "Income",
    "y_label": "SpendingScore",
    "title": "K-Means 聚类结果 (K=3)"
  },
  "centers": [
    [55.0, 48.0],
    [25.0, 75.0],
    [40.0, 30.0]
  ],
  "summary": {
    "0": {"count": 65, "mean": {"Income": 55.0, "SpendingScore": 48.0}},
    "1": {"count": 42, "mean": {"Income": 25.0, "SpendingScore": 75.0}},
    "2": {"count": 93, "mean": {"Income": 40.0, "SpendingScore": 30.0}}
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `inertia` | number | 簇内平方和，用于评估聚类效果 |
| `n_clusters` | integer | 聚类数（回显） |
| `columns` | ColumnInfo[] | 更新后的列信息（含新增的 `cluster` 列，dtype 为 `"int64"`） |
| `chart_data` | ChartData | 可直接渲染的散点图数据，data 中每项带 `cluster` 字段 |
| `centers` | number[][] | 各簇中心点坐标（原始尺度），顺序对应 cluster 0,1,2... |
| `summary` | object | 各簇统计：样本数 + 各特征均值 |

---

### 3.5 数据导出 —— `POST /api/export`

**请求**：Content-Type: `application/json`

```json
{
  "session_id": "a1b2c3d4e5f6",
  "format": "csv"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `session_id` | string | 是 | — | 会话 ID |
| `format` | string | 否 | `"csv"` | 导出格式：`"csv"` / `"excel"` |

**响应**：
- Content-Type: `text/csv` 或 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="exported_data.{csv|xlsx}"`
- 编码：UTF-8（无 BOM）
- 响应体为文件二进制流，`index=False`（不导出 pandas 行号）

**前端处理**：fetch 后读取 `response.blob()`，创建临时 `<a>` 标签触发下载。

---

### 3.6 健康检查 —— `GET /api/health`

**请求**：无参数，无认证。

**成功响应**：

```json
{
  "status": "ok"
}
```

**用途**：前端启动时 ping 此端点判断后端是否在线，若超时或失败则显示"后端未连接"提示。

---

## 4. 图表数据格式规范

### 4.1 通用结构

所有图表数据遵循统一的 `ChartData` 对象：

```typescript
type ChartData =
  | { chart_type: "histogram";        data: HistogramDatum[];        x_label?: string; y_label?: string; title?: string }
  | { chart_type: "scatter";          data: ScatterDatum[];          x_label?: string; y_label?: string; title?: string }
  | { chart_type: "box";              data: BoxDatum[];              x_label?: string; y_label?: string; title?: string }
  | { chart_type: "bar";              data: BarDatum[];              x_label?: string; y_label?: string; title?: string }
  | { chart_type: "cluster_scatter";  data: ClusterScatterDatum[];   x_label?: string; y_label?: string; title?: string };
```

### 4.2 各类型 `data` 元素形状

#### histogram（直方图）

```json
{
  "chart_type": "histogram",
  "data": [
    {"label": "0–10", "value": 5},
    {"label": "10–20", "value": 23}
  ],
  "x_label": "Age",
  "y_label": "Frequency",
  "title": "年龄分布"
}
```

| data 字段 | 类型 | 说明 |
|-----------|------|------|
| `label` | string | 区间标签（后端完成分箱） |
| `value` | number | 该区间频数 |

#### scatter（散点图）

```json
{
  "chart_type": "scatter",
  "data": [
    {"x": 34.0, "y": 50.0},
    {"x": 23.0, "y": 78.0}
  ],
  "x_label": "Income",
  "y_label": "SpendingScore",
  "title": "Income vs Spending Score"
}
```

| data 字段 | 类型 | 说明 |
|-----------|------|------|
| `x` | number | X 轴数值 |
| `y` | number | Y 轴数值 |

#### cluster_scatter（聚类散点图）

由 `/api/analyze` 返回，数据点比普通散点图多一个 `cluster` 字段用于区分颜色：

```json
{
  "chart_type": "cluster_scatter",
  "data": [
    {"x": 34.0, "y": 50.0, "cluster": 0},
    {"x": 23.0, "y": 78.0, "cluster": 1}
  ],
  "x_label": "Income",
  "y_label": "SpendingScore",
  "title": "K-Means 聚类结果 (K=3)"
}
```

| data 字段 | 类型 | 说明 |
|-----------|------|------|
| `x` | number | X 轴数值 |
| `y` | number | Y 轴数值 |
| `cluster` | number | 所属簇编号（0, 1, 2...） |

#### box（箱线图）

```json
{
  "chart_type": "box",
  "data": [
    {
      "label": "Age",
      "min": 18.0,
      "q1": 28.0,
      "median": 35.0,
      "q3": 48.0,
      "max": 72.0,
      "outliers": [85.0, 90.0]
    }
  ],
  "y_label": "Age",
  "title": "年龄分布箱线图"
}
```

| data 字段 | 类型 | 说明 |
|-----------|------|------|
| `label` | string | 变量名 |
| `min` | number | 最小值（不含异常值） |
| `q1` | number | 第一四分位数 |
| `median` | number | 中位数 |
| `q3` | number | 第三四分位数 |
| `max` | number | 最大值（不含异常值） |
| `outliers` | number[] | 异常值列表 |

#### bar（柱状图）

```json
{
  "chart_type": "bar",
  "data": [
    {"label": "Electronics", "value": 150.0},
    {"label": "Clothing", "value": 230.0}
  ],
  "x_label": "Category",
  "y_label": "Avg Sales",
  "title": "各类别平均销售额"
}
```

| data 字段 | 类型 | 说明 |
|-----------|------|------|
| `label` | string | 分类标签 |
| `value` | number | 数值（频次或聚合值） |

### 4.3 设计原则

- **后端做计算，前端做渲染**：分箱、聚合、统计全部在后端完成，前端只拿到可直接绑定图表的干净数据。
- **对象数组而非并行数组**：`[{x, y}]` 优于 `{x: [...], y: [...]}`——每个数据点自包含，扩展字段不破坏结构。
- **库无关**：不依赖 Plotly 或 Recharts 的特定格式，前端组件负责将 `ChartData` 转换为目标库的配置。

---

## 5. 变更记录

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-04 | 1.0 | 初始版本，统一前后端契约，废止 docs/ 下的旧 SPEC 文档 |
