"""K-Means 聚类分析 — 匹配 share/protocol.md §3.4"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def kmeans_analyze(
    df: pd.DataFrame,
    columns: list[str],
    n_clusters: int = 3,
    plot_x: str | None = None,
    plot_y: str | None = None,
) -> dict:
    """
    执行 K-Means 聚类，返回协议定义的 AnalyzeResponse 格式。
    """
    # 校验列
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"列不存在: {missing}")

    # 确认数值列
    numeric_cols = df[columns].select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        raise ValueError("至少需要 2 个数值列参与聚类")

    data = df[numeric_cols].dropna()
    if len(data) < n_clusters:
        raise ValueError(f"有效数据行数 ({len(data)}) 少于聚类数 ({n_clusters})")

    # 标准化
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    # K-Means
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = model.fit_predict(scaled_data)

    inertia = float(model.inertia_)

    # 反标准化中心点
    centers = scaler.inverse_transform(model.cluster_centers_).tolist()
    centers = [[float(v) for v in row] for row in centers]

    # 各簇摘要
    result_df = data.copy()
    result_df["cluster"] = labels
    summary = {}
    for i in range(n_clusters):
        cluster_data = result_df[result_df["cluster"] == i]
        summary[str(i)] = {
            "count": int(len(cluster_data)),
            "mean": {col: float(cluster_data[col].mean()) for col in numeric_cols},
        }

    # 散点图数据（用 plot_x / plot_y）
    px = plot_x if plot_x and plot_x in numeric_cols else numeric_cols[0]
    py = plot_y if plot_y and plot_y in numeric_cols else (
        numeric_cols[1] if len(numeric_cols) > 1 else numeric_cols[0]
    )

    scatter_df = result_df[[px, py, "cluster"]].dropna()
    chart_data = {
        "chart_type": "cluster_scatter",
        "data": [
            {
                "x": float(r[px]),
                "y": float(r[py]),
                "cluster": int(r["cluster"]),
            }
            for _, r in scatter_df.iterrows()
        ],
        "x_label": str(px),
        "y_label": str(py),
        "title": f"K-Means 聚类结果 (K={n_clusters})",
    }

    # 返回列信息（含新增的 cluster）
    all_columns = df.columns.tolist()
    col_info = [{"name": col, "dtype": str(df[col].dtype)} for col in all_columns]
    col_info.append({"name": "cluster", "dtype": "int64"})

    return {
        "inertia": inertia,
        "n_clusters": n_clusters,
        "columns": col_info,
        "chart_data": chart_data,
        "centers": centers,
        "summary": summary,
    }
