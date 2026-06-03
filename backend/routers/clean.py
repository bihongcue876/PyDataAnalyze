"""数据清洗路由"""

import os
from fastapi import APIRouter, HTTPException
from config import UPLOAD_DIR
from models.schemas import CleanRequest
from models.database import save_record
from services.cleaning import fill_missing, remove_outliers, drop_duplicates
from utils.file_handler import load_dataframe_with_session, save_dataframe_to_session

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

    if req.remove_outliers and req.outlier_column:
        df = remove_outliers(df, req.outlier_column, req.outlier_method)
        operations.append(f"异常值剔除({req.outlier_column}, {req.outlier_method})")

    if req.drop_duplicates:
        df = drop_duplicates(df)
        operations.append("重复值删除")

    # 保存清洗后的数据
    save_dataframe_to_session(df, session_dir)
    save_record("session", "clean", f"清洗操作: {'; '.join(operations)}")

    return {
        "success": True,
        "operations": operations,
        "rows": len(df),
        "cols": len(df.columns),
        "preview": df.head(20).fillna("").to_dict(orient="records"),
        "columns": [{"name": col, "dtype": str(df[col].dtype)} for col in df.columns],
    }
