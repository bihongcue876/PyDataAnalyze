"""Pydantic 数据模型 — 与 share/protocol.md v1.1 完全一致"""


from pydantic import BaseModel

# ============================================================
# 共享数据类型
# ============================================================

class ColumnInfo(BaseModel):
    """列描述"""
    name: str
    dtype: str


# ============================================================
# 图表数据类型
# ============================================================

class HistogramDatum(BaseModel):
    label: str
    value: int

class ScatterDatum(BaseModel):
    x: float
    y: float

class ClusterScatterDatum(ScatterDatum):
    cluster: int

class BoxDatum(BaseModel):
    label: str
    min: float
    q1: float
    median: float
    q3: float
    max: float
    outliers: list[float]

class BarDatum(BaseModel):
    label: str
    value: float

class PieDatum(BaseModel):
    label: str
    value: int

class HeatmapDatum(BaseModel):
    x: str
    y: str
    value: float

class ScatterPanel(BaseModel):
    x_col: str
    y_col: str
    data: list[ScatterDatum]


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
    chart_type: str  # histogram / scatter / box / bar / pie / line / heatmap / scatter_matrix
    x_column: str | None = None
    y_column: str | None = None
    columns: list[str] | None = None
    color_column: str | None = None


class AnalyzeParams(BaseModel):
    """分析方法参数字典"""
    n_clusters: int | None = None        # kmeans / agglomerative
    eps: float | None = None             # dbscan
    min_samples: int | None = None       # dbscan
    n_components: int | None = None      # pca


class AnalyzeRequest(BaseModel):
    """POST /api/analyze"""
    session_id: str
    method: str = "kmeans"  # kmeans / dbscan / agglomerative / pca
    columns: list[str]
    params: AnalyzeParams = AnalyzeParams()
    n_clusters: int | None = None  # 向后兼容: 旧前端在顶层发送 n_clusters
    plot_x: str | None = None
    plot_y: str | None = None


class CompareMethodItem(BaseModel):
    """多算法对比中的单个方法配置"""
    type: str  # kmeans / dbscan / agglomerative / pca
    params: AnalyzeParams = AnalyzeParams()


class AnalyzeCompareRequest(BaseModel):
    """POST /api/analyze/compare"""
    session_id: str
    columns: list[str]
    methods: list[CompareMethodItem]


class ExportRequest(BaseModel):
    """POST /api/export"""
    session_id: str
    format: str = "csv"  # csv / excel
