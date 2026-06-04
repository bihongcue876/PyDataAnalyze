"""健康检查路由"""

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check():
    """健康检查 — 前端用此端点判断后端是否在线"""
    return {"status": "ok"}
