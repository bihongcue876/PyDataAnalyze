# PyDataAnalyze 后端规约文档

本文档为后端服务的详细技术规约，旨在作为 Coding Agent 或开发人员的参考实现指南。所有 API 设计、数据库模式、模块职责与数据流均在此明确定义，开发时需严格遵循。

---

## 1. 概述

后端采用 **FastAPI** 框架，提供 RESTful API 服务。主要职责包括：
- 接收并解析用户上传的 CSV/Excel 文件
- 以会话形式管理用户数据生命周期
- 提供数据清洗、可视化数据生成、K-Means 聚类分析、结果导出等功能
- 使用 **SQLite** 记录上传与分析历史
- 与前端通过 JSON 及文件流交互，支持跨域访问

## 2. 技术栈与运行时环境

- **语言**：Python 3.9+
- **Web 框架**：FastAPI
- **ASGI 服务器**：uvicorn
- **数据库**：SQLite（通过标准库 `sqlite3`）
- **数据处理库**：pandas、numpy、scikit-learn（仅在 `data_utils.py` 中使用）
- **跨域处理**：`fastapi.middleware.cors.CORSMiddleware`
- **文件上传**：`fastapi.UploadFile`
- **依赖安装**：`pip install fastapi uvicorn pandas openpyxl scikit-learn`
- 包管理：在本文件夹下创建uv包管理。

## 3. 模块划分与职责

后端代码位于 `backend/` 目录下，文件结构如下：

```
backend/
├── main.py           # 应用入口，挂载路由，配置 CORS，注册启动事件
├── routes.py         # 所有 API 端点实现，负责参数校验与响应构建
├── services.py       # 业务逻辑：会话管理（DataFrame 缓存）、数据库操作
├── models.py         # Pydantic 请求/响应模型定义
├── database.py       # SQLite 数据库初始化与连接管理
└── data_utils.py     # 纯数据处理与算法函数（由数据处理同学维护，后端仅调用）
```

各模块职责：

- **main.py**：创建 FastAPI 实例，添加 CORS 中间件（允许 `*` 来源），在 startup 事件中调用 `database.init_db()` 确保表存在，并挂载 `routes.router`。
- **routes.py**：定义 5 个端点（见下文），每个端点函数只做：解析请求参数 → 调用 `services.py` 中的会话/数据库操作 → 调用 `data_utils.py` 中的相应函数 → 构建并返回 JSON 响应或 FileResponse。
- **services.py**：
  - `SessionManager`：内存字典 `sessions: dict`，键为 `session_id`（UUID 字符串），值为 `pd.DataFrame`。提供 `get(session_id)`、`set(session_id, df)`、`delete(session_id)` 方法。
  - `DB` 类或函数集：封装 `sqlite3` 连接，提供 `insert_upload_record(...)`、`insert_analysis_record(...)`、`get_recent_uploads(limit)` 等方法。数据库路径通过配置文件获取。
- **models.py**：定义 Pydantic `BaseModel` 子类，用于 FastAPI 自动生成文档和请求体验证。例如 `CleanRequest`、`ChartRequest`、`AnalyzeRequest` 等。
- **database.py**：负责执行建表 SQL（`CREATE TABLE IF NOT EXISTS ...`），导出 `get_db_connection()` 函数（返回 `sqlite3.connect` 对象）。
- **data_utils.py**：导出三个函数：`clean_data()`, `cluster_data()`, `build_chart_data()`。后端不修改此文件，仅调用。

## 4. 数据库设计

数据库文件 `pyanalyze.db` 存储在项目根目录的 `database/` 文件夹。应用启动时自动创建以下表：

### 表 `uploads`
| 列名          | 类型    | 约束              | 说明                         |
|---------------|---------|-------------------|------------------------------|
| id            | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键                 |
| session_id    | TEXT    | NOT NULL          | 关联的会话标识               |
| filename      | TEXT    | NOT NULL          | 原始文件名                   |
| upload_time   | DATETIME| DEFAULT CURRENT_TIMESTAMP | 上传时间戳            |
| row_count     | INTEGER | NOT NULL          | 原始数据行数                 |
| columns_json  | TEXT    | NOT NULL          | 列名列表的 JSON 字符串       |

### 表 `analysis_history`
| 列名          | 类型    | 约束              | 说明                                   |
|---------------|---------|-------------------|----------------------------------------|
| id            | INTEGER | PRIMARY KEY AUTOINCREMENT | 主键                           |
| session_id    | TEXT    | NOT NULL          | 关联的会话标识                         |
| method        | TEXT    | NOT NULL          | 分析方法，如 "kmeans"                  |
| params_json   | TEXT    | NOT NULL          | 分析参数 JSON，如特征列、聚类数等      |
| inertia       | REAL    |                   | 聚类惯性值（若为 K-Means）             |
| created_at    | DATETIME| DEFAULT CURRENT_TIMESTAMP | 记录创建时间                  |

## 5. API 端点详细规约

所有接口均以 `/api` 为前缀，响应内容类型为 `application/json`，除 `/api/export` 返回 CSV 文件。发生错误时统一返回如下格式：

```json
{
  "error": "具体错误描述"
}
```

### 5.1 文件上传与预览

**端点**：`POST /api/upload`

**请求**：
- Content-Type: `multipart/form-data`
- 字段 `file`：上传的 CSV 或 Excel 文件。

**处理逻辑**：
1. 检查文件扩展名是否为 `.csv`、`.xls`、`.xlsx`，否则返回 400 错误。
2. 使用 `pd.read_csv` 或 `pd.read_excel` 读取文件为 DataFrame。
3. 生成唯一 `session_id`（使用 `uuid.uuid4()`）。
4. 将 DataFrame 存入 `SessionManager`。
5. 将上传信息写入 `uploads` 表：
   - `session_id`，`filename`，`row_count`，`columns_json`（`df.columns.tolist()` 的 JSON 字符串）。
6. 提取前 5 行数据作为预览，返回 JSON。

**成功响应**（200）：
```json
{
  "session_id": "a1b2c3d4-...",
  "columns": ["Column1", "Column2", "..."],
  "preview": [
    {"Column1": val, "Column2": val, ...},
    ...
  ],
  "shape": [100, 5]
}
```
- `session_id`：字符串，后续操作需携带。
- `columns`：字符串数组，所有列名。
- `preview`：对象数组，前 5 行数据。
- `shape`：数组 `[行数, 列数]`。

### 5.2 数据清洗

**端点**：`POST /api/clean`

**请求**：
- Content-Type: `application/json`
- 请求体：
```json
{
  "session_id": "a1b2c3d4-...",
  "missing_strategy": "mean",
  "outlier_method": "iqr"
}
```
- `missing_strategy`：可选值 `"mean"`, `"median"`, `"drop"`。默认 `"mean"`。
- `outlier_method`：可选值 `"iqr"`, `"none"`。默认 `"iqr"`。

**处理逻辑**：
1. 根据 `session_id` 获取当前 DataFrame。
2. 调用 `data_utils.clean_data(df, missing_strategy, outlier_method)` 获得清洗后 DataFrame。
3. 更新 `SessionManager` 中的 DataFrame（覆盖）。
4. 返回清洗后的预览与形状。

**成功响应**（200）：
```json
{
  "preview": [ ... ],
  "shape": [95, 5],
  "columns": ["Column1", ...]
}
```

### 5.3 图表数据生成

**端点**：`POST /api/chart`

**请求**：
- Content-Type: `application/json`
- 请求体：
```json
{
  "session_id": "a1b2c3d4-...",
  "chart_type": "histogram",
  "column": "Age",
  "column2": "Income"   // 仅散点图时使用，可选
}
```
- `chart_type`：字符串，`"histogram"`, `"scatter"`, `"box"` 之一。
- `column`：必须为 DataFrame 中存在的列名。
- `column2`：当 `chart_type` 为 `"scatter"` 时必填，其他情况忽略。

**处理逻辑**：
1. 获取会话 DataFrame，验证列存在。
2. 调用 `data_utils.build_chart_data(df, chart_type, column, column2)` 获取图表数据字典。
3. 返回该字典。

**`build_chart_data` 函数输出规约**（供后端转发）：
- 直方图：`{"type": "histogram", "x": [...], "bins": [...]}` 或直接提供 Plotly/Recharts 所需的 `{data: [...], layout: {...}}` 格式。此处约定返回 **简单数据格式**，例如：
  ```json
  {
    "chart_type": "histogram",
    "data": {
      "labels": ["0-10", "10-20", ...],
      "values": [5, 23, ...]
    }
  }
  ```
  但为了前后端解耦，最终决策：`build_chart_data` 返回的 dict 会直接作为 `chart_data` 字段的值，不做额外封装。具体格式由数据处理同学与前端协商，后端只负责传递。

- 散点图：`{"chart_type": "scatter", "data": {"x": [...], "y": [...]}}`。
- 箱线图：`{"chart_type": "box", "data": {"labels": [...], "values": [...]}}`。

**成功响应**（200）：
```json
{
  "chart_data": { ... }   // 由 data_utils.build_chart_data 返回的字典
}
```

### 5.4 聚类分析

**端点**：`POST /api/analyze`

**请求**：
- Content-Type: `application/json`
- 请求体：
```json
{
  "session_id": "a1b2c3d4-...",
  "features": ["Income", "SpendingScore"],
  "n_clusters": 3
}
```
- `features`：字符串数组，参与聚类的数值列名。
- `n_clusters`：整数，聚类数量，默认 3。

**处理逻辑**：
1. 获取会话 DataFrame，检查 `features` 列是否存在且为数值型。
2. 调用 `data_utils.cluster_data(df, features, n_clusters)`，该函数返回 `(df_with_clusters, inertia)`。
3. 更新会话中的 DataFrame（新 DataFrame 增加了 `cluster` 列）。
4. 调用 `data_utils.build_chart_data(df_with_clusters, chart_type="scatter", column=features[0], column2=features[1])` 获取聚类散点图数据（或单独生成带颜色的散点图，由数据处理同学提供）。
   - 更优方案：`cluster_data` 除了返回 inertia，也返回可直接用于绘图的 plotly 图表数据或前端可渲染的数据结构（例如 `{"x": [...], "y": [...], "cluster": [...]}`），避免后端再次调用 `build_chart_data`。此处约定 **`cluster_data` 额外返回 `plot_data`**，即返回一个三元组 `(df_new, inertia, plot_data)`，`plot_data` 为字典。
5. 将分析记录插入 `analysis_history` 表：
   - `session_id`，`method` = `"kmeans"`，`params_json` = `{"features": [...], "n_clusters": n}`，`inertia`。
6. 返回惯性值与绘图数据。

**成功响应**（200）：
```json
{
  "inertia": 1234.56,
  "plot_data": {
    "x": [...],
    "y": [...],
    "cluster": [...]
  },
  "columns": ["col1", "col2", ..., "cluster"]
}
```

### 5.5 数据导出

**端点**：`GET /api/export`

**请求**：
- 查询参数：`session_id` (必须)

**处理逻辑**：
1. 根据 `session_id` 获取当前 DataFrame（此时应为清洗后或分析后版本）。
2. 将 DataFrame 转换为 CSV 格式（`index=False`）。
3. 返回文件流，文件名 `cleaned_data.csv`，`Content-Type: text/csv`，`Content-Disposition: attachment`。

**错误响应**：如果 `session_id` 无效，返回 404。

## 6. 会话管理

- 会话数据（DataFrame）仅存储在内存的 `sessions` 字典中，键为 `session_id`（字符串），值为 `pd.DataFrame`。
- 会话没有自动过期机制（简化处理），但可在后续扩展中加入 TTL。
- 数据库记录的 `session_id` 可用于历史查询，即使内存中 DataFrame 丢失（重启后），历史记录依然存在，但无法再次执行操作。这是可接受的限制。

## 7. 数据处理函数接口约定

以下函数由 `data_utils.py` 提供，后端开发人员无需关心内部实现，只需按约定调用：

```python
def clean_data(df: pd.DataFrame, missing_strategy: str = 'mean', outlier_method: str = 'iqr') -> pd.DataFrame:
    """
    清洗数据。
    missing_strategy: 'mean' | 'median' | 'drop'
    outlier_method: 'iqr' | 'none'
    返回清洗后的 DataFrame。
    """
    pass

def cluster_data(df: pd.DataFrame, features: List[str], n_clusters: int = 3) -> Tuple[pd.DataFrame, float, dict]:
    """
    对 df 的指定数值列执行 K-Means 聚类。
    features: 用于聚类的列名列表
    n_clusters: 聚类数
    返回:
      - 带有 'cluster' 列的新 DataFrame
      - inertia (float)
      - plot_data: 包含聚类结果散点图数据的字典，例如 { "x": [...], "y": [...], "cluster": [...] }
    """
    pass

def build_chart_data(df: pd.DataFrame, chart_type: str, column: str, column2: str = None) -> dict:
    """
    生成指定图表所需的数据字典。
    chart_type: 'histogram' | 'scatter' | 'box'
    返回格式由前后端协定，但必须是 JSON 可序列化的字典。
    """
    pass
```

**异常处理**：若输入参数无效（如列名不存在、非数值列用于聚类），函数应抛出 `ValueError` 并附带明确信息。后端在路由层会捕获该异常并返回 400。

## 8. 错误处理规约

- 所有路由内部均需包裹 `try-except`，捕获已知异常：
  - `ValueError`：参数问题，返回 400。
  - `KeyError`：会话不存在，返回 404。
  - `pd.errors.ParserError`：文件解析失败，返回 400。
- 未知异常记录日志（print 或 logging），返回 500 状态码 `{"error": "Internal server error"}`，不暴露内部错误信息。

## 9. 配置

在 `backend/config.py`（可选）或直接在 `main.py` 顶部定义：

- `DATABASE_PATH`：默认 `"../database/pyanalyze.db"`（相对 backend 目录）
- `UPLOAD_TEMP_DIR`：临时上传目录，本方案可忽略（文件直接在内存读取）
- `CORS_ORIGINS`：`["*"]`

## 10. 开发注意事项

1. **依赖隔离**：`data_utils.py` 仅允许依赖 `pandas`, `numpy`, `sklearn`；后端其余代码不应直接导入 `sklearn`。
2. **无状态原则**：API 不应依赖服务器本地文件长期存储，上传文件后及时释放。
3. **CORS**：务必设置允许所有来源，方便前端开发时跨域。
4. **线程安全**：FastAPI 默认单线程异步，内存字典在多 worker 下不共享。本项目开发及演示阶段使用单 worker，若需扩展可考虑 Redis 等缓存。
5. **代码风格**：使用类型注解，Pydantic 模型，保持代码整洁。

---

本文档作为后端开发的唯一事实来源，所有实现须与此保持一致。如有接口或逻辑变更，必须同步更新此规约。