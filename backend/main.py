"""PyDataAnalyze 后端入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models.database import init_db
from routers import upload, clean, analyze, visualize, export

app = FastAPI(title="PyDataAnalyze", version="0.1.0")

# CORS 配置（允许前端开发服务器跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(upload.router)
app.include_router(clean.router)
app.include_router(analyze.router)
app.include_router(visualize.router)
app.include_router(export.router)


@app.on_event("startup")
def on_startup():
    """应用启动时初始化数据库"""
    init_db()


@app.get("/")
def root():
    return {"message": "PyDataAnalyze API is running", "docs": "/docs"}
