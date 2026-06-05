# PyDataAnalyze

交互式数据分析系统，支持文件上传、数据清洗、可视化和聚类分析。

## 快速开始

### 后端

```bash
cd backend
uv sync
uv run uvicorn main:app --reload
```

服务运行在 `http://localhost:8000`，API 文档访问 `http://localhost:8000/docs`

### 前端

```bash
cd frontend
npm install
npm run dev
```

服务运行在 `http://localhost:5173`

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload` | 上传文件（CSV/Excel/JSON/Parquet/Feather/ZIP），返回预览数据 |
| POST | `/api/clean` | 数据清洗操作 |
| POST | `/api/chart` | 获取图表数据（histogram/scatter/box/bar/pie/line/heatmap/scatter_matrix） |
| POST | `/api/analyze` | 分析（K-Means / DBSCAN / 层次聚类 / PCA），含评估指标 |
| POST | `/api/export` | 导出结果为 CSV / Excel |
| GET  | `/api/history` | 历史记录列表 |
| GET  | `/api/session/{session_id}` | 加载历史会话 |
| GET  | `/api/health` | 健康检查 |

> 完整 API 规范见 [`share/protocol.md`](share/protocol.md)，TypeScript 类型见 [`share/protocol.ts`](share/protocol.ts)

## 技术栈

- **后端**: FastAPI (Python 3.14+)
- **前端**: React + Vite + ECharts
- **数据库**: SQLite
- **数据处理**: Pandas, NumPy, Scikit-learn

## 功能

- 上传 CSV / Excel / JSON / JSONL / Parquet / Feather / ZIP 文件并预览
- 数据清洗：缺失值填充（均值/中位数/众数/删除）、异常值剔除（IQR/Z-Score）、重复值删除
- 数据可视化：直方图、散点图、箱线图、柱状图、饼图、折线图、热力图、散点矩阵
- 聚类分析：K-Means、DBSCAN、层次聚类 + 各簇摘要 + 评估指标
- 降维分析：PCA 主成分分析 + 解释方差比
- 分析结果导出（CSV / Excel）
- 历史记录与会话恢复

## 工程分工

| 负责人 | 负责部分 |
|---|---|
| 一 | 后端，统调，微调 |
| 二 | 前端，协调 |
| 三 | 数据获取审核，数据清洗测试，单元测试 |
| 四 | 数据主要获取，统测，用户测试 |
