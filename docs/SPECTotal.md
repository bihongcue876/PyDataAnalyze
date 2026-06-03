以下为项目总体规约文件，无详细代码和目录结构，适合作为团队开发共识的基础文档。

---

# PyDataAnalyze 项目总体规约

## 一、项目概述
**项目名称**：PyDataAnalyze  
**项目性质**：交互式数据分析系统，基于 Web 的轻量级数据探索工具  
**目标**：  
实现完整的数据处理流水线——用户上传 CSV/Excel 文件 → 数据清洗 → 多种可视化图表 → 至少一种机器学习分析（K-Means 聚类） → 结果导出，并提供响应式 Web 界面。

## 二、功能特性（已实现与扩展方向）
### 必做功能
- 文件上传与预览（支持 CSV、Excel 格式）
- 数据清洗：缺失值处理（均值/中位数填充）、异常值检测（IQR 方法）
- 动态可视化：生成直方图、散点图、箱线图，用户可自选列与图表参数
- 机器学习分析：K-Means 聚类，允许用户选择特征列和聚类数，展示聚类散点图
- 数据导出：清洗后的数据可下载为 CSV

### 扩展功能（已规划、按需开发）
- 数据库集成：使用 SQLite 存储上传历史与分析记录，支持历史检索
- 多算法对比与效果评估
- 用户自定义清洗规则配置
- 多用户登录与权限管理

## 三、团队分工（4人）

| 角色 | 核心职责 |
|------|----------|
| **数据采集与测试** | 搜集或生成至少两个场景的测试数据集；设计测试用例，对每个功能进行验收；记录问题、截图与操作演示；输出测试报告。 |
| **后端开发** | 搭建 FastAPI 服务，实现全部 API 端点；设计并操作 SQLite 数据库（记录上传历史、分析历史）；管理会话与 DataFrame 缓存；与前端联调接口。 |
| **前端开发** | 使用 React 开发单页面应用；构建上传、清洗、可视化、聚类、导出等交互面板；对接后端 API，使用图表库（Recharts 或 Plotly.js）渲染可交互图表；确保响应式布局。 |
| **数据处理与算法** | 编写独立的纯函数数据处理模块；实现数据清洗（缺失值填充、IQR 异常值过滤）、K-Means 聚类封装、图表数据格式化函数；确保函数可被后端直接调用。 |

## 四、技术选型与架构概要
- **后端**：FastAPI (Python)，提供 RESTful API，使用 CORS 中间件与前端通信。
- **前端**：React + JSX，使用 Bootstrap 实现响应式布局，图表库采用 Recharts 或 Plotly.js。
- **数据库**：SQLite，用于存储上传历史和部分分析记录。
- **数据处理**：pandas 进行表格数据处理，scikit-learn 实现 K-Means 聚类，numpy 辅助数值计算。
- **会话管理**：服务端内存字典，以 UUID 为键缓存当前工作阶段的 DataFrame，无需持久化文件。
- **文件处理**：文件流直接读取，不依赖长期物理存储，仅临时缓存。

**数据流**：  
浏览器(React) → HTTP 请求 → FastAPI 路由 → 调用数据处理函数 → 返回 JSON 数据 / CSV 流 → 前端渲染或触发下载。

## 五、API 接口约定（概要）
所有接口前缀为 `/api`，请求和响应均为 JSON 格式，文件上传使用 `multipart/form-data`。关键端点设计如下：

1. **POST /api/upload**  
   - 请求：文件 (`file` 字段)  
   - 响应：`session_id`、`columns` (列名列表)、`preview` (前N行数据)、`shape` (行数, 列数)  
   - 说明：后端生成唯一会话ID，缓存 DataFrame，并在数据库记录上传操作。

2. **POST /api/clean**  
   - 请求：`session_id`、`missing_strategy`、`outlier_method`  
   - 响应：`preview`、`shape`、`columns`  
   - 说明：执行清洗后更新缓存的 DataFrame。

3. **POST /api/chart**  
   - 请求：`session_id`、`chart_type` (histogram/scatter/box)、`column` (X轴列名)、`column2` (Y轴列名，散点图可选)  
   - 响应：`chart_data` (前端绘图所需的数据结构，如柱状图的 bins 与 counts)  
   - 说明：只返回数据，不返回 HTML/图片，由前端自行渲染。

4. **POST /api/analyze**  
   - 请求：`session_id`、`features` (特征列名列表)、`n_clusters`  
   - 响应：`inertia` (聚类惯性值)、`plot_data` (用于绘制聚类散点图的数据)、更新后的 `columns` (含 `cluster` 列)  
   - 说明：执行 K-Means，将簇标签附加到 DataFrame 并缓存，同时记录本次分析到数据库。

5. **GET /api/export**  
   - 请求：`session_id` (作为查询参数)  
   - 响应：CSV 文件流，浏览器直接下载。  
   - 说明：返回当前会话清洗后的数据文件。

## 六、SQLite 数据库表结构规约
在应用启动时自动创建以下表（如不存在）：

- **uploads** 表：`id` (INTEGER PRIMARY KEY), `session_id` (TEXT), `filename` (TEXT), `upload_time` (DATETIME), `row_count` (INTEGER), `columns_json` (TEXT)
- **analysis_history** 表：`id` (INTEGER PRIMARY KEY), `session_id` (TEXT), `method` (TEXT 如 "kmeans"), `params_json` (TEXT), `inertia` (REAL), `created_at` (DATETIME)

所有数据库操作使用原生 sqlite3 实现，不引入 ORM。

## 七、数据处理模块函数约定
由数据处理同学独立实现，对外暴露以下三个函数，与后端约定的签名如下：

- `clean_data(df, missing_strategy='mean', outlier_method='iqr') -> pd.DataFrame`
- `cluster_data(df, features, n_clusters=3) -> (df_with_clusters, inertia)`
- `build_chart_data(df, chart_type, column, column2=None) -> dict`（返回前端可用的绘图数据）

所有函数仅依赖 pandas、numpy、sklearn，不涉及网络或数据库。

## 八、协作流程与约定
1. **接口先行**：前后端及数据处理同学须在开发前共同确认 API 文档和函数签名，无歧义后各自开发。
2. **并行开发**：后端可先使用模拟数据实现 API，前端可使用模拟 JSON 开发界面，数据处理同学可单独测试函数。
3. **版本管理**：所有代码纳入 Git，遵循基本的 commit 信息规范，每人每日提交工作进度。
4. **测试驱动**：数据采集与测试同学需尽早提供测试数据集，每完成一个功能即进行验收，避免问题堆积。
5. **文档同步**：每人负责撰写个人贡献模块的文档，最终汇总为完整报告，统一使用同一个文档模板。

## 九、交付物清单
- 可运行的 Web 系统源码（前端、后端、数据处理模块）
- 至少两份测试数据集
- 功能测试报告与操作截图
- 个人成果展示文档（每人一份）
- 项目 README（包含运行说明）

以上规约旨在保证团队四人对项目目标、架构、接口和分工达成共识，开发过程中可适度调整，但需同步更新本文档。