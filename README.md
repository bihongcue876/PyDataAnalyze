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
| POST | `/api/upload` | 上传文件并返回预览数据 |
| POST | `/api/clean` | 数据清洗操作 |
| POST | `/api/cluster` | K-Means 聚类分析 |
| POST | `/api/visualize` | 获取图表数据 |
| POST | `/api/export` | 导出结果为文件 |


## 技术栈

- **后端**: FastAPI (Python)
- **前端**: React + Vite
- **数据库**: SQLite
- **数据处理**: Pandas, NumPy, Scikit-learn

## 功能

- 上传 CSV / Excel 文件并预览
- 数据清洗：缺失值填充、异常值剔除、重复值删除
- 数据可视化：柱状图、折线图、散点图、饼图
- K-Means 聚类分析
- 分析结果导出（CSV / Excel）

## 工程分工
| 负责人 | 负责部分 |
|---|---|
| 一 | 后端，统调，微调 |
| 二 | 前端，协调 |
| 三 | 数据获取审核，数据清洗测试，单元测试 |
| 四 | 数据主要获取，统测，用户测试 |