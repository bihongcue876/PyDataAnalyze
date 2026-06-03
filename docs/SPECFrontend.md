# PyDataAnalyze 前端框架规约

本文档为前端应用的技术规约，旨在作为 Coding Agent 或开发人员的参考实现指南。前端采用 React + JSX 构建单页面应用，对接后端 RESTful API，实现完整的数据分析交互界面。

---

## 1. 概述

前端是一个响应式单页面应用，用户通过浏览器与系统交互。核心功能包括：

- 上传 CSV/Excel 文件，实时预览表格数据
- 配置清洗策略并执行数据清洗
- 选择列与图表类型，动态生成可交互图表
- 选择特征进行 K-Means 聚类，查看聚类结果散点图
- 导出清洗后的数据为 CSV

所有数据通过后端 API 获取，前端仅负责界面呈现与用户交互。

## 2. 技术栈与开发环境

- **框架**：React 18+
- **构建工具**：Vite（推荐，轻量快速）或 Create React App
- **语言**：JavaScript (JSX)，可选用 TypeScript 但非必需
- **样式**：Bootstrap 5（通过 CDN 引入或 npm 包）
- **图表库**：Recharts 或 Plotly.js（推荐 Plotly.js 以获得交互性，也可用 Recharts 简单易用）
- **HTTP 请求**：Fetch API 或 axios
- **依赖安装**：`npm install react react-dom bootstrap plotly.js-dist-min`（根据选择调整）

## 3. 项目结构

前端代码位于 `frontend/` 目录下，结构如下：

```
frontend/
├── public/
│   └── index.html           # 页面入口模板
├── src/
│   ├── App.jsx              # 根组件，管理全局状态与步骤流
│   ├── index.jsx            # ReactDOM 渲染入口
│   ├── api.js               # 封装所有后端 API 请求函数
│   ├── components/
│   │   ├── UploadPanel.jsx  # 文件上传与数据预览表格
│   │   ├── CleanPanel.jsx   # 清洗策略选择与执行
│   │   ├── ChartPanel.jsx   # 图表类型与列选择，渲染图表
│   │   ├── ClusterPanel.jsx # 聚类参数配置与结果展示
│   │   └── ExportButton.jsx # 导出按钮
│   └── utils.js             # 通用工具函数（可选）
├── package.json
└── vite.config.js           # Vite 配置（若使用）
```

## 4. 全局状态设计

在 `App.jsx` 中使用 React Hooks（`useState`）管理以下全局状态：

| 状态变量 | 类型 | 初始值 | 说明 |
|----------|------|--------|------|
| `sessionId` | string | `null` | 当前会话 ID，上传成功后获得 |
| `columns` | string[] | `[]` | 当前 DataFrame 的列名列表 |
| `previewData` | object[] | `[]` | 表格预览数据（前 N 行，对象数组） |
| `currentStep` | string | `'upload'` | 当前激活步骤，用于控制面板显示（如 'upload', 'clean', 'chart', 'cluster', 'export'） |

这些状态通过 props 传递给子组件，子组件可以通过回调函数更新父状态（例如上传成功后设置 `sessionId` 和 `columns`）。

## 5. API 交互层 (`api.js`)

该文件封装所有与后端的 HTTP 请求，返回 Promise，供组件调用。基础 URL 配置为 `http://localhost:8000/api`（开发环境，可配置环境变量）。

需要实现的函数及签名：

- `uploadFile(file)`：
  - 参数：`file` (File 对象)
  - 方法：POST `/upload`，Content-Type: `multipart/form-data`
  - 返回：Promise，解析为后端响应 JSON（`{session_id, columns, preview, shape}`）

- `cleanData(sessionId, missingStrategy, outlierMethod)`：
  - 参数：`sessionId` (string)，`missingStrategy` (string)，`outlierMethod` (string)
  - 方法：POST `/clean`，JSON body
  - 返回：Promise，解析为 `{preview, shape, columns}`

- `getChartData(sessionId, chartType, column, column2?)`：
  - 参数：同上，`column2` 可选
  - 方法：POST `/chart`，JSON body
  - 返回：Promise，解析为 `{chart_data}`，其中 `chart_data` 格式由前后端协商（见下文图表数据格式约定）

- `runClustering(sessionId, features, nClusters)`：
  - 参数：`sessionId` (string)，`features` (字符串数组)，`nClusters` (number)
  - 方法：POST `/analyze`，JSON body
  - 返回：Promise，解析为 `{inertia, plot_data, columns}`

- `exportData(sessionId)`：
  - 参数：`sessionId` (string)
  - 方法：GET `/export?session_id=...`，触发浏览器下载（可使用 `window.open` 或创建临时链接）

错误处理：每个函数应检查 `response.ok`，若不成功则抛出错误并附带后端返回的 `{error}` 消息，供组件显示提示。

## 6. 组件功能规约

### 6.1 App.jsx (主容器)

- 布局：使用 Bootstrap 的 `container`，顶部标题“PyDataAnalyze - 交互式数据分析”。
- 步骤流：根据 `currentStep` 显示对应面板，但所有面板并不是严格分步，而是可以同时显示（或分 Tab）。推荐使用卡片布局，从上到下依次排列：上传、清洗、可视化、聚类、导出。当未完成前置步骤时，后续面板禁用或隐藏。
- 状态提升：所有操作状态由 `App` 管理，通过 props 下传和回调更新。

### 6.2 UploadPanel.jsx

**Props**：
- `onUploadSuccess(sessionId, columns, preview)`：上传成功回调
- `setCurrentStep` 等（可选）

**UI 元素**：
- 文件选择框（`<input type="file" accept=".csv,.xlsx,.xls">`）
- 上传按钮，触发 `api.uploadFile`
- 上传成功后展示数据预览表格：使用 Bootstrap `table-responsive` 容器，动态生成 `<table>`，表头为 `columns`，内容为 `preview` 数组前 10 行。
- 显示数据基本信息：行数、列数。

**行为**：
- 点击上传 → 调用 `api.uploadFile` → 成功后更新 App 状态（sessionId, columns, preview） → 启用后续面板。

### 6.3 CleanPanel.jsx

**Props**：
- `sessionId`
- `columns` (用于可能的重置)
- `onCleanSuccess(preview, shape, columns)`：回调更新全局状态

**UI 元素**：
- 缺失值处理下拉框：`mean` (均值填充)、`median` (中位数填充)、`drop` (删除含缺失行)
- 异常值检测选项：`iqr` (启用)、`none` (关闭)，用复选框或下拉
- “执行清洗”按钮

**行为**：
- 点击执行 → 调用 `api.cleanData` → 成功后更新 App 中的 `previewData` 和 `columns`，提示成功信息。

### 6.4 ChartPanel.jsx

**Props**：
- `sessionId`
- `columns`
- `previewData` (可选)

**UI 元素**：
- 图表类型下拉框：直方图、散点图、箱线图
- X 轴列选择下拉框（根据 `columns` 动态生成选项）
- Y 轴列选择下拉框（仅当图表类型为散点图时显示）
- “生成图表”按钮
- 图表展示区域（`<div>` 用于渲染 Plotly 或 Recharts）

**行为**：
- 选择图表类型与列 → 点击生成 → 调用 `api.getChartData` → 使用返回的 `chart_data` 渲染图表。
- **图表渲染**：
  - 若使用 Plotly.js：`Plotly.newPlot(container, chart_data.data, chart_data.layout)`（如果后端直接返回 plotly 格式）
  - 若后端返回简单数据（如 `{x: [...], y: [...]}`），前端自行构造 Plotly 或 Recharts 的 props。
  - **约定**：为灵活，前端期望 `chart_data` 是一个包含 `type`、`data` 和可选 `layout` 的对象，由组件负责将其转化为相应图表的配置。若使用 Recharts，需定制化较高，建议项目初期就约定图表数据格式，使两种库都能直接消费。
  - 图表应支持交互：悬停显示数值、缩放（Plotly 默认支持）。

### 6.5 ClusterPanel.jsx

**Props**：
- `sessionId`
- `columns`

**UI 元素**：
- 特征选择多选下拉框（显示所有列，建议只选数值列，但前端无类型信息，可提交后由后端校验）
- 聚类数输入框（数字输入，默认 3，最小 2）
- “运行聚类”按钮
- 惯性值显示
- 聚类结果散点图展示区域

**行为**：
- 点击运行 → 调用 `api.runClustering` → 成功后更新 App 的 `columns`（新增 `cluster` 列，但不影响其他面板），显示惯性值，渲染返回的 `plot_data` 散点图（用不同颜色区分 cluster）。
- 聚类散点图使用与 ChartPanel 相同的图表库，数据格式应为 `{x: [...], y: [...], cluster: [...]}`，前端映射 `cluster` 为颜色。

### 6.6 ExportButton.jsx

**Props**：
- `sessionId`

**UI**：一个按钮（“导出清洗后数据 CSV”）。

**行为**：
- 点击按钮 → 调用 `api.exportData(sessionId)` → 触发浏览器下载。

## 7. 图表数据格式约定

为了前后端解耦，数据处理模块 (`data_utils.py`) 返回的图表数据应满足前端期望。**统一约定**如下：

- 所有图表数据封装为对象，具有以下字段：
  - `type`：字符串，图表类型（`'histogram'`, `'scatter'`, `'box'`）
  - `data`：数组，对于直方图和箱线图，每个元素为 `{label, value}`；对于散点图，每个元素为 `{x, y}`；对于聚类散点图，为 `{x, y, cluster}`
  - `x_label`、`y_label`（可选）：坐标轴标题
  - `title`（可选）：图表标题

示例（直方图）：
```json
{
  "type": "histogram",
  "data": [{"label": "0-10", "value": 5}, {"label": "10-20", "value": 12}, ...],
  "x_label": "年龄区间",
  "y_label": "频数",
  "title": "年龄分布直方图"
}
```

示例（聚类散点图）：
```json
{
  "type": "scatter",
  "data": [{"x": 34, "y": 50, "cluster": 0}, {"x": 23, "y": 78, "cluster": 1}, ...],
  "x_label": "收入",
  "y_label": "消费评分",
  "title": "K-Means 聚类结果"
}
```

前端组件根据 `type` 和 `data` 构建图表，确保与后端返回一致即可。该格式在规约阶段与数据处理同学达成一致。

## 8. 样式与响应式

- 使用 Bootstrap 5 的 Grid 系统和组件，确保在桌面和移动端显示良好。
- 所有面板使用 `card` 样式，内部元素使用 `form-control`, `btn`, `table` 等标准类。
- 图表容器设置 `width: 100%`，高度固定或自适应。

## 9. 错误处理与用户提示

- 每个 API 调用失败时（网络错误或后端返回 error），在前端使用 `alert` 或 Bootstrap 的 toast/alert 组件显示错误消息，避免静默失败。
- 操作进行中显示“加载中”状态（按钮禁用+文字变化），使用简单的 `isLoading` 状态控制。

## 10. 开发注意事项

1. **跨域**：开发时后端运行在 `localhost:8000`，前端在 `localhost:5173`（Vite 默认），后端已配置 CORS，无需额外设置。
2. **API 基础 URL**：可在 `api.js` 中定义为常量，便于切换部署环境。
3. **组件可维护性**：每个面板组件保持独立，业务逻辑尽量在 `App` 中通过状态管理，子组件只负责渲染和触发回调。
4. **依赖图**：确保不会循环引用，`api.js` 被组件引用，`utils.js` 被任意文件引用，组件之间不直接引入彼此。
5. **测试**：前端开发可与后端同步进行，使用模拟数据（mock）先行开发 UI，直到后端接口就绪。

---

本文档定义了前端框架的组件树、数据流、交互逻辑和接口依赖，开发时须严格遵守。任何修改应同步更新本规约。