"""图表数据路由 — POST /api/chart"""

import os

from fastapi import APIRouter, HTTPException

from config import UPLOAD_DIR
from models.database import save_record
from models.schemas import ChartRequest
from services.visualization import prepare_chart_data
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["chart"])


@router.post("/chart")
async def get_chart_data(req: ChartRequest):
    """获取图表数据，直接返回 ChartData 对象（无包装键）"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    try:
        chart_data = prepare_chart_data(
            df,
            chart_type=req.chart_type,
            x_column=req.x_column,
            y_column=req.y_column,
            columns=req.columns,
            color_column=req.color_column,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    save_record("session", "chart", f"图表: {req.chart_type}")

    return chart_data
