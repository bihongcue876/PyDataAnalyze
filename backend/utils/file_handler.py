"""文件上传处理工具"""

import os
import uuid
import math
from typing import Any

import pandas as pd
from config import UPLOAD_DIR, ALLOWED_EXTENSIONS

# 文件大小上限：10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024


class FileSizeError(ValueError):
    """文件超过大小限制时抛出"""



def _convert_nan(obj: Any) -> Any:
    """递归将 NaN / infinity 转换为 None（JSON null）"""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _convert_nan(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_nan(v) for v in obj]
    return obj


def save_upload_file(file) -> str:
    """保存上传文件，返回保存路径"""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件格式: {ext}，仅支持 {ALLOWED_EXTENSIONS}")

    # 校验文件大小
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE:
        raise FileSizeError(f"文件过大（{size / 1024 / 1024:.1f} MB），上限为 10 MB")

    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(save_path, "wb") as f:
        f.write(file.file.read())

    return save_path


def load_dataframe(file_path: str) -> pd.DataFrame:
    """根据文件扩展名加载 DataFrame"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(file_path, encoding="utf-8")
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    raise ValueError(f"无法读取的文件格式: {ext}")


def load_dataframe_with_session(session_dir: str) -> pd.DataFrame | None:
    """从 session 目录加载 DataFrame"""
    csv_path = os.path.join(session_dir, "data.csv")
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    return None


def save_dataframe_to_session(df: pd.DataFrame, session_dir: str):
    """将 DataFrame 保存到 session 目录"""
    os.makedirs(session_dir, exist_ok=True)
    df.to_csv(os.path.join(session_dir, "data.csv"), index=False)


def df_to_preview(df: pd.DataFrame, n: int = 20) -> list[dict]:
    """提取前 n 行并将 NaN 转换为 null"""
    records = df.head(n).to_dict(orient="records")
    return _convert_nan(records)


def columns_info(df: pd.DataFrame) -> list[dict]:
    """返回列信息列表"""
    return [{"name": col, "dtype": str(df[col].dtype)} for col in df.columns]
