"""数据清洗路由 — POST /api/clean"""

import os

from fastapi import APIRouter, HTTPException

from config import UPLOAD_DIR
from models.database import save_record
from models.schemas import CleanRequest
from services.cleaning import drop_duplicates, fill_missing, remove_outliers
from utils.file_handler import (
    columns_info,
    df_to_preview,
    load_dataframe_with_session,
    save_dataframe_to_session,
)

router = APIRouter(prefix="/api", tags=["clean"])


@router.post("/clean")
async def clean_data(req: CleanRequest):
    """执行数据清洗操作"""
    session_dir = os.path.join(UPLOAD_DIR, req.session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    operations = []

    if req.fill_missing:
        df = fill_missing(df, req.fill_strategy)
        operations.append(f"缺失值填充({req.fill_strategy})")

    if req.remove_outliers:
        df = remove_outliers(df, req.outlier_columns, req.outlier_method)
        operations.append(f"异常值剔除({req.outlier_method})")

    if req.drop_duplicates:
        df = drop_duplicates(df)
        operations.append("重复值删除")

    save_dataframe_to_session(df, session_dir)
    save_record("session", "clean", f"清洗操作: {'; '.join(operations)}")

    return {
        "operations": operations,
        "rows": len(df),
        "cols": len(df.columns),
        "columns": columns_info(df),
        "preview": df_to_preview(df),
    }
