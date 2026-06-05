"""聚类/降维分析 — 匹配 share/protocol.md v1.1 §3.4

支持方法: kmeans / dbscan / agglomerative / pca
"""

import contextlib

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, AgglomerativeClustering, KMeans
from sklearn.decomposition import PCA
from sklearn.metrics import (
    calinski_harabasz_score,
    davies_bouldin_score,
    silhouette_score,
)
from sklearn.preprocessing import StandardScaler


def analyze(
    df: pd.DataFrame,
    method: str,
    columns: list[str],
    params: dict | None = None,
    plot_x: str | None = None,
    plot_y: str | None = None,
) -> dict:
    """
    统一分析入口，按 method 派发到具体实现。

    params 支持字段:
      - n_clusters: int   (kmeans / agglomerative)
      - eps: float        (dbscan)
      - min_samples: int  (dbscan)
      - n_components: int (pca)
    """
    params = params or {}

    numeric_cols = _validate_columns(df, columns)
    data = df[numeric_cols].dropna()

    if method == "kmeans":
        return _kmeans(data, numeric_cols, params, plot_x, plot_y, df)
    elif method == "dbscan":
        return _dbscan(data, numeric_cols, params, plot_x, plot_y, df)
    elif method == "agglomerative":
        return _agglomerative(data, numeric_cols, params, plot_x, plot_y, df)
    elif method == "pca":
        return _pca(data, numeric_cols, params, plot_x, plot_y, df)
    else:
        raise ValueError(f"不支持的分析方法: {method}")


# ============================================================
# 内部工具
# ============================================================

def _validate_columns(df: pd.DataFrame, columns: list[str]) -> list[str]:
    """校验列存在且为数值型，返回数值列列表"""
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"列不存在: {missing}")

    numeric_cols = df[columns].select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        raise ValueError("至少需要 2 个数值列参与分析")
    return numeric_cols


def _pick_plot_cols(numeric_cols: list[str],
                    plot_x: str | None,
                    plot_y: str | None) -> tuple[str, str]:
    """选取散点图的两个轴"""
    px = plot_x if plot_x and plot_x in numeric_cols else numeric_cols[0]
    py = plot_y if plot_y and plot_y in numeric_cols else (
        numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0]
    )
    return px, py


def _build_cluster_chart(result_df: pd.DataFrame,
                         px: str, py: str,
                         method: str,
                         label_col: str = "cluster") -> dict:
    """构建聚类散点图 ChartData"""
    plot_df = result_df[[px, py, label_col]].dropna()
    data = [
        {
            "x": float(r[px]),
            "y": float(r[py]),
            "cluster": int(r[label_col]),
        }
        for _, r in plot_df.iterrows()
    ]
    return {
        "chart_type": "cluster_scatter",
        "data": data,
        "x_label": str(px),
        "y_label": str(py),
        "title": f"{method} 聚类结果",
    }


def _build_column_info(df: pd.DataFrame, extra_cols: list[str] | None = None) -> list[dict]:
    """构建列信息列表"""
    info = [{"name": col, "dtype": str(df[col].dtype)} for col in df.columns]
    if extra_cols:
        for col in extra_cols:
            info.append({"name": col, "dtype": "int64"})
    return info


def _compute_clustering_metrics(data: np.ndarray, labels: np.ndarray) -> dict:
    """计算聚类评估指标"""
    metrics: dict = {}
    unique_labels = set(labels)
    # 至少需要 2 个有效簇（排除噪声 -1）
    valid_labels = [lb for lb in unique_labels if lb >= 0]
    n_valid = len(valid_labels)

    if n_valid >= 2 and len(data) > n_valid:
        # 过滤噪声点
        mask = labels >= 0
        if mask.sum() > n_valid:
            with contextlib.suppress(Exception):
                metrics["silhouette_score"] = round(
                    float(silhouette_score(data[mask], labels[mask])), 4
                )
            with contextlib.suppress(Exception):
                metrics["calinski_harabasz_score"] = round(
                    float(calinski_harabasz_score(data[mask], labels[mask])), 4
                )
            with contextlib.suppress(Exception):
                metrics["davies_bouldin_score"] = round(
                    float(davies_bouldin_score(data[mask], labels[mask])), 4
                )
    return metrics


def _build_summary(result_df: pd.DataFrame,
                   numeric_cols: list[str],
                   label_col: str = "cluster") -> dict:
    """构建各簇摘要"""
    summary = {}
    for label in sorted(result_df[label_col].unique()):
        cluster_data = result_df[result_df[label_col] == label]
        summary[str(label)] = {
            "count": int(len(cluster_data)),
            "mean": {col: float(cluster_data[col].mean()) for col in numeric_cols},
        }
    return summary


# ============================================================
# K-Means
# ============================================================

def _kmeans(data: pd.DataFrame, numeric_cols: list[str],
            params: dict, plot_x: str | None, plot_y: str | None,
            original_df: pd.DataFrame) -> dict:
    n_clusters = params.get("n_clusters", 3)
    if len(data) < n_clusters:
        raise ValueError(f"有效数据行数 ({len(data)}) 少于聚类数 ({n_clusters})")

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = model.fit_predict(scaled_data)

    inertia = float(model.inertia_)
    centers = scaler.inverse_transform(model.cluster_centers_).tolist()
    centers = [[float(v) for v in row] for row in centers]

    result_df = data.copy()
    result_df["cluster"] = labels

    px, py = _pick_plot_cols(numeric_cols, plot_x, plot_y)
    chart_data = _build_cluster_chart(result_df, px, py, "K-Means")
    chart_data["title"] = f"K-Means 聚类结果 (K={n_clusters})"
    summary = _build_summary(result_df, numeric_cols)
    metrics = _compute_clustering_metrics(scaled_data, labels)

    return {
        "method": "kmeans",
        "inertia": inertia,
        "centers": centers,
        "columns": _build_column_info(original_df, ["cluster"]),
        "chart_data": chart_data,
        "summary": summary,
        "metrics": metrics,
    }


# ============================================================
# DBSCAN
# ============================================================

def _dbscan(data: pd.DataFrame, numeric_cols: list[str],
            params: dict, plot_x: str | None, plot_y: str | None,
            original_df: pd.DataFrame) -> dict:
    eps = params.get("eps", 0.5)
    min_samples = params.get("min_samples", 5)

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    model = DBSCAN(eps=eps, min_samples=min_samples)
    labels = model.fit_predict(scaled_data)

    result_df = data.copy()
    result_df["cluster"] = labels.tolist()

    px, py = _pick_plot_cols(numeric_cols, plot_x, plot_y)
    chart_data = _build_cluster_chart(result_df, px, py, "DBSCAN")
    chart_data["title"] = f"DBSCAN 聚类结果 (eps={eps}, min_samples={min_samples})"

    summary = _build_summary(result_df, numeric_cols)
    metrics = _compute_clustering_metrics(scaled_data, labels)
    n_noise = int((labels == -1).sum())
    metrics["noise_points"] = n_noise
    metrics["n_clusters"] = int(len(set(labels)) - (1 if -1 in labels else 0))

    return {
        "method": "dbscan",
        "columns": _build_column_info(original_df, ["cluster"]),
        "chart_data": chart_data,
        "summary": summary,
        "metrics": metrics,
    }


# ============================================================
# Agglomerative Clustering
# ============================================================

def _agglomerative(data: pd.DataFrame, numeric_cols: list[str],
                   params: dict, plot_x: str | None, plot_y: str | None,
                   original_df: pd.DataFrame) -> dict:
    n_clusters = params.get("n_clusters", 3)
    if len(data) < n_clusters:
        raise ValueError(f"有效数据行数 ({len(data)}) 少于聚类数 ({n_clusters})")

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    model = AgglomerativeClustering(n_clusters=n_clusters)
    labels = model.fit_predict(scaled_data)

    # 凝聚聚类没有中心点，用各簇均值近似
    result_df = data.copy()
    result_df["cluster"] = labels.tolist()
    centers = []
    for i in range(n_clusters):
        cluster_data = result_df[result_df["cluster"] == i]
        if not cluster_data.empty:
            centers.append([float(cluster_data[col].mean()) for col in numeric_cols])

    px, py = _pick_plot_cols(numeric_cols, plot_x, plot_y)
    chart_data = _build_cluster_chart(result_df, px, py, "Agglomerative")
    chart_data["title"] = f"层次聚类结果 (K={n_clusters})"

    summary = _build_summary(result_df, numeric_cols)
    metrics = _compute_clustering_metrics(scaled_data, labels)

    return {
        "method": "agglomerative",
        "centers": centers,
        "columns": _build_column_info(original_df, ["cluster"]),
        "chart_data": chart_data,
        "summary": summary,
        "metrics": metrics,
    }


# ============================================================
# PCA 降维
# ============================================================

def _pca(data: pd.DataFrame, numeric_cols: list[str],
         params: dict, plot_x: str | None, plot_y: str | None,
         original_df: pd.DataFrame) -> dict:
    n_components = params.get("n_components", 2)
    max_components = min(n_components, len(numeric_cols), len(data))
    if max_components < 2:
        raise ValueError("PCA 至少需要 2 个维度")

    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    model = PCA(n_components=max_components, random_state=42)
    transformed = model.fit_transform(scaled_data)

    # 构建结果 DataFrame
    pc_cols = [f"PC{i+1}" for i in range(max_components)]
    result_df = pd.DataFrame(transformed, columns=pc_cols, index=data.index)

    px = plot_x if plot_x and plot_x in pc_cols else pc_cols[0]
    py = plot_y if plot_y and plot_y in pc_cols else (
        pc_cols[1] if len(pc_cols) > 1 else pc_cols[0]
    )

    plot_data = result_df[[px, py]].dropna()
    chart_data = {
        "chart_type": "scatter",
        "data": [
            {"x": float(r[px]), "y": float(r[py])}
            for _, r in plot_data.iterrows()
        ],
        "x_label": str(px),
        "y_label": str(py),
        "title": f"PCA 降维结果 ({px} vs {py})",
    }

    explained_variance = [round(float(v), 4) for v in model.explained_variance_ratio_]

    # 列信息（包含新增的 PC 列）
    col_info = _build_column_info(original_df)
    for pc in pc_cols:
        col_info.append({"name": pc, "dtype": "float64"})

    return {
        "method": "pca",
        "columns": col_info,
        "chart_data": chart_data,
        "metrics": {
            "explained_variance_ratio": explained_variance,
        },
    }
