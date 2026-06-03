"""文件上传处理工具"""

import os
import uuid
import pandas as pd
from config import UPLOAD_DIR, ALLOWED_EXTENSIONS


def save_upload_file(file) -> str:
    """
    保存上传文件，返回保存路径
    """
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件格式: {ext}，仅支持 {ALLOWED_EXTENSIONS}")

    # 生成唯一文件名防止冲突
    unique_name = f"{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(save_path, "wb") as f:
        f.write(file.file.read())

    return save_path


def load_dataframe(file_path: str) -> pd.DataFrame:
    """
    根据文件扩展名加载 DataFrame
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        return pd.read_csv(file_path)
    elif ext in (".xlsx", ".xls"):
        return pd.read_excel(file_path)
    raise ValueError(f"无法读取的文件格式: {ext}")


def load_dataframe_with_session(session_dir: str) -> pd.DataFrame | None:
    """
    从 session 目录加载 DataFrame
    """
    csv_path = os.path.join(session_dir, "data.csv")
    if os.path.exists(csv_path):
        return pd.read_csv(csv_path)
    return None


def save_dataframe_to_session(df: pd.DataFrame, session_dir: str):
    """
    将 DataFrame 保存到 session 目录
    """
    os.makedirs(session_dir, exist_ok=True)
    df.to_csv(os.path.join(session_dir, "data.csv"), index=False)
