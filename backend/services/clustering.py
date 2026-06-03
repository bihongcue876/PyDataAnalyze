"""K-Means 聚类分析"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler


def kmeans_cluster(df: pd.DataFrame, columns: list[str], n_clusters: int = 3) -> dict:
    """
    对指定列执行 K-Means 聚类

    返回：
        dict 包含聚类标签、中心点坐标、各簇数据统计
    """
    # 提取数据并去缺失
    data = df[columns].dropna()

    if len(data) < n_clusters:
        raise ValueError(f"有效数据行数 ({len(data)}) 少于聚类数 ({n_clusters})")

    # 标准化
    scaler = StandardScaler()
    scaled_data = scaler.fit_transform(data)

    # 聚类
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = model.fit_predict(scaled_data)

    # 组装结果
    result_df = data.copy()
    result_df["cluster"] = labels

    centers = model.cluster_centers_.tolist()
    # 反标准化中心点
    centers_original = scaler.inverse_transform(model.cluster_centers_).tolist()

    cluster_summary = {}
    for i in range(n_clusters):
        cluster_data = result_df[result_df["cluster"] == i]
        cluster_summary[str(i)] = {
            "count": int(len(cluster_data)),
            "mean": cluster_data[columns].mean().to_dict(),
        }

    return {
        "labels": labels.tolist(),
        "clusters": result_df["cluster"].tolist(),
        "centers": centers_original,
        "summary": cluster_summary,
        "columns": columns,
        "n_clusters": n_clusters,
    }
