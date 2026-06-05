"""历史会话加载路由 — GET /api/session/{session_id}"""

import os

from fastapi import APIRouter, HTTPException

from config import UPLOAD_DIR
from utils.file_handler import columns_info, df_to_preview, load_dataframe_with_session

router = APIRouter(prefix="/api", tags=["session"])


@router.get("/session/{session_id}")
async def load_session(session_id: str):
    """加载历史会话数据预览"""
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail="session 不存在或已过期")

    df = load_dataframe_with_session(session_dir)
    if df is None:
        raise HTTPException(status_code=404, detail="未找到数据")

    return {
        "session_id": session_id,
        "rows": len(df),
        "cols": len(df.columns),
        "columns": columns_info(df),
        "preview": df_to_preview(df),
    }
