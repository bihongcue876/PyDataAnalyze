"""聚类分析路由 — POST /api/analyze"""

import os
from fastapi import APIRouter, HTTPException
from config import UPLOAD_DIR
from models.schemas import AnalyzeRequest
from models.database import save_record
from services.clustering import kmeans_analyze
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze")
async def cluster_analysis(req: AnalyzeRequest):
    """执行 K-Means 聚类分析，返回 AnalyzeResponse"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    try:
        result = kmeans_analyze(
            df,
            columns=req.columns,
            n_clusters=req.n_clusters,
            plot_x=req.plot_x,
            plot_y=req.plot_y,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    save_record(
        "session", "analyze",
        f"聚类: 列={req.columns}, K={req.n_clusters}",
    )

    return result
