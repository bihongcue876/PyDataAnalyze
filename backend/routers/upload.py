"""文件上传路由"""

import os
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from utils.file_handler import save_upload_file, load_dataframe, save_dataframe_to_session
from config import UPLOAD_DIR
from models.database import save_record

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传文件，返回预览数据和 session_id"""
    try:
        file_path = save_upload_file(file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        df = load_dataframe(file_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")

    # 创建 session 目录保存处理过程中的数据
    session_id = uuid.uuid4().hex
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    save_dataframe_to_session(df, session_dir)

    # 记录操作
    save_record(file.filename, "upload", f"上传文件，{len(df)} 行 {len(df.columns)} 列")

    # 返回预览（前 20 行 + 列信息）
    preview = df.head(20).fillna("").to_dict(orient="records")
    columns = [{"name": col, "dtype": str(df[col].dtype)} for col in df.columns]

    return {
        "session_id": session_id,
        "filename": file.filename,
        "rows": len(df),
        "cols": len(df.columns),
        "columns": columns,
        "preview": preview,
    }
