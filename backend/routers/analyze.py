"""聚类分析路由"""

import os
from fastapi import APIRouter, HTTPException
from config import UPLOAD_DIR
from models.schemas import ClusterRequest
from models.database import save_record
from services.clustering import kmeans_cluster
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/cluster")
async def cluster_analysis(req: ClusterRequest):
    """执行 K-Means 聚类分析"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    # 检查列是否存在
    for col in req.columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"列 '{col}' 不存在")

    try:
        result = kmeans_cluster(df, req.columns, req.n_clusters)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    save_record("session", "cluster", f"聚类: 列={req.columns}, K={req.n_clusters}")

    return {
        "success": True,
        "result": result,
    }
