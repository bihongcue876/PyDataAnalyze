"""结果导出路由"""

import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from config import UPLOAD_DIR
from models.schemas import ExportRequest
from models.database import save_record
from services.exporter import export_csv, export_excel
from utils.file_handler import load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["export"])


@router.post("/export")
async def export_data(req: ExportRequest):
    """导出处理后的数据为文件"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    try:
        if req.format == "csv":
            filepath = export_csv(df)
            media_type = "text/csv"
            filename = "export.csv"
        elif req.format == "excel":
            filepath = export_excel(df)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = "export.xlsx"
        else:
            raise HTTPException(status_code=400, detail=f"不支持的导出格式: {req.format}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

    save_record("session", "export", f"导出为 {req.format}")

    return FileResponse(filepath, media_type=media_type, filename=filename)
