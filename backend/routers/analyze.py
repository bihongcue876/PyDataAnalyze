"""聚类/降维分析路由 — POST /api/analyze"""

import json
import os

from fastapi import APIRouter, HTTPException

from config import UPLOAD_DIR
from models.database import save_analysis_record
from models.schemas import AnalyzeRequest
from services.clustering import analyze
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze")
async def cluster_analysis(req: AnalyzeRequest):
    """执行聚类/降维分析，返回 AnalyzeResponse"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    params_dict = req.params.model_dump(exclude_none=True) if req.params else {}

    # 向后兼容: 旧前端在顶层发送 n_clusters
    if req.n_clusters is not None and "n_clusters" not in params_dict:
        params_dict["n_clusters"] = req.n_clusters

    try:
        result = analyze(
            df,
            method=req.method,
            columns=req.columns,
            params=params_dict,
            plot_x=req.plot_x,
            plot_y=req.plot_y,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    save_analysis_record(
        session_id=req.session_id,
        method=req.method,
        params_json=json.dumps(params_dict, ensure_ascii=False),
        inertia=result.get("inertia"),
        metrics_json=json.dumps(result.get("metrics", {}), ensure_ascii=False),
    )

    return result
