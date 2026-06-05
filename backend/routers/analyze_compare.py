"""多算法对比路由 — POST /api/analyze/compare"""

import json
import os

from fastapi import APIRouter, HTTPException

from config import UPLOAD_DIR
from models.database import save_analysis_record
from models.schemas import AnalyzeCompareRequest
from services.clustering import analyze
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["analyze"])


@router.post("/analyze/compare")
async def compare_analysis(req: AnalyzeCompareRequest):
    """多算法对比分析，返回各算法的分析结果数组"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    results = []
    for item in req.methods:
        params_dict = item.params.model_dump(exclude_none=True) if item.params else {}

        try:
            result = analyze(
                df,
                method=item.type,
                columns=req.columns,
                params=params_dict,
            )
        except ValueError as e:
            result = {
                "method": item.type,
                "error": str(e),
            }

        results.append(result)

        # 记录每个成功的分析
        if "error" not in result:
            save_analysis_record(
                session_id=req.session_id,
                method=item.type,
                params_json=json.dumps(params_dict, ensure_ascii=False),
                inertia=result.get("inertia"),
                metrics_json=json.dumps(result.get("metrics", {}), ensure_ascii=False),
            )

    return {"results": results}
