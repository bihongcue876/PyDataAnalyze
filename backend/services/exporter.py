"""结果导出 — 匹配 share/protocol.md §3.5"""

import os
import tempfile
import pandas as pd
from config import EXPORT_DIR


def export_csv(df: pd.DataFrame) -> str:
    """导出为 CSV（UTF-8 无 BOM），返回文件路径"""
    os.makedirs(EXPORT_DIR, exist_ok=True)
    filepath = os.path.join(EXPORT_DIR, "exported_data.csv")
    df.to_csv(filepath, index=False, encoding="utf-8")
    return filepath


def export_excel(df: pd.DataFrame) -> str:
    """导出为 Excel，返回文件路径"""
    os.makedirs(EXPORT_DIR, exist_ok=True)
    filepath = os.path.join(EXPORT_DIR, "exported_data.xlsx")
    df.to_excel(filepath, index=False, engine="openpyxl")
    return filepath
