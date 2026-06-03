"""可视化数据路由"""

import os
from fastapi import APIRouter, HTTPException
from config import UPLOAD_DIR
from models.schemas import VisualizeRequest
from models.database import save_record
from services.visualization import prepare_chart_data
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["visualize"])


@router.post("/visualize")
async def visualize_data(req: VisualizeRequest):
    """获取图表数据"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    try:
        chart_data = prepare_chart_data(df, req.chart_type, req.x_column, req.y_column)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    save_record("session", "visualize", f"图表: {req.chart_type}(x={req.x_column}, y={req.y_column})")

    return {
        "success": True,
        "data": chart_data,
    }
