"""Pydantic 数据模型 — 与 share/protocol.md 完全一致"""

from pydantic import BaseModel
from typing import Any


# ============================================================
# 共享数据类型
# ============================================================

class ColumnInfo(BaseModel):
    """列描述"""
    name: str
    dtype: str


# ============================================================
# API 请求体
# ============================================================

class CleanRequest(BaseModel):
    """POST /api/clean"""
    session_id: str
    fill_missing: bool
    fill_strategy: str = "mean"  # mean / median / mode / drop
    remove_outliers: bool
    outlier_columns: list[str] = []
    outlier_method: str = "iqr"  # iqr / zscore
    drop_duplicates: bool


class ChartRequest(BaseModel):
    """POST /api/chart"""
    session_id: str
    chart_type: str  # histogram / scatter / box / bar
    x_column: str | None = None
    y_column: str | None = None
    columns: list[str] | None = None


class AnalyzeRequest(BaseModel):
    """POST /api/analyze"""
    session_id: str
    columns: list[str]
    n_clusters: int = 3
    plot_x: str | None = None
    plot_y: str | None = None


class ExportRequest(BaseModel):
    """POST /api/export"""
    session_id: str
    format: str = "csv"  # csv / excel
