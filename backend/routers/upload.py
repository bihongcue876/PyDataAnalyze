"""文件上传路由 — POST /api/upload"""

import os
import uuid

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import UPLOAD_DIR
from models.database import save_record, save_upload_record
from utils.file_handler import (
    FileSizeError,
    columns_info,
    df_to_preview,
    load_dataframe,
    save_dataframe_to_session,
    save_upload_file,
)

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):  # noqa: B008
    """上传文件，返回 session_id、预览数据和列信息"""
    try:
        file_path = save_upload_file(file)
    except FileSizeError as e:
        raise HTTPException(status_code=413, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    try:
        df = load_dataframe(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}") from e

    session_id = uuid.uuid4().hex
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    save_dataframe_to_session(df, session_dir)

    save_record(file.filename, "upload", f"上传文件，{len(df)} 行 {len(df.columns)} 列")
    save_upload_record(session_id, file.filename, len(df), len(df.columns))

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "cols": len(df.columns),
        "columns": columns_info(df),
        "preview": df_to_preview(df),
    }
