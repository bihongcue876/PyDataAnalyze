"""历史记录路由 — GET /api/history"""

from fastapi import APIRouter

from models.database import get_analysis_history, get_uploads

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def list_history(limit: int = 100, offset: int = 0):
    """获取上传和分析历史记录"""
    uploads = get_uploads(limit=limit, offset=offset)
    analyses = get_analysis_history(limit=limit, offset=offset)

    return {
        "uploads": uploads,
        "analyses": analyses,
    }
