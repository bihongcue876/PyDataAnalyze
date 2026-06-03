"""结果导出"""

import os
import uuid
import pandas as pd
from config import EXPORT_DIR


def export_csv(df: pd.DataFrame) -> str:
    """导出为 CSV，返回文件路径"""
    filename = f"export_{uuid.uuid4().hex}.csv"
    filepath = os.path.join(EXPORT_DIR, filename)
    df.to_csv(filepath, index=False, encoding="utf-8-sig")
    return filepath


def export_excel(df: pd.DataFrame) -> str:
    """导出为 Excel，返回文件路径"""
    filename = f"export_{uuid.uuid4().hex}.xlsx"
    filepath = os.path.join(EXPORT_DIR, filename)
    df.to_excel(filepath, index=False, engine="openpyxl")
    return filepath
