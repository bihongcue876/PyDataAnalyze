"""Pydantic 数据模型"""

from pydantic import BaseModel
from typing import Any


class CleanRequest(BaseModel):
    """清洗请求"""
    session_id: str
    fill_missing: bool = True
    fill_strategy: str = "mean"  # mean / median / mode / drop
    remove_outliers: bool = False
    outlier_column: str = ""
    outlier_method: str = "iqr"  # iqr / zscore
    drop_duplicates: bool = True


class ClusterRequest(BaseModel):
    """聚类请求"""
    session_id: str
    columns: list[str]
    n_clusters: int = 3


class VisualizeRequest(BaseModel):
    """可视化请求"""
    session_id: str
    chart_type: str  # bar / line / scatter / pie
    x_column: str
    y_column: str = ""


class ExportRequest(BaseModel):
    """导出请求"""
    session_id: str
    format: str = "csv"  # csv / excel
