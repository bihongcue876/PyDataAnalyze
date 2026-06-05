"""PyDataAnalyze 后端入口 — FastAPI 应用"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from models.database import init_db
from routers import analyze, chart, clean, export, health, history, session, upload

app = FastAPI(title="PyDataAnalyze", version="0.1.0")

# CORS 配置
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
app.include_router(chart.router)
app.include_router(analyze.router)
app.include_router(export.router)
app.include_router(health.router)
app.include_router(history.router)
app.include_router(session.router)


# ============================================================
# 统一错误处理 — 所有错误响应格式为 {"error": "..."}
# ============================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first_error = errors[0] if errors else {}
    msg = first_error.get("msg", "请求参数不合法")
    return JSONResponse(
        status_code=400,
        content={"error": msg},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": "服务器内部错误"},
    )


# ============================================================
# 生命周期
# ============================================================

@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/")
def root():
    return {"message": "PyDataAnalyze API is running", "docs": "/docs"}
