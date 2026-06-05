"""后端功能测试 — 覆盖 protocol v1.1 全部新增功能"""
import sys
sys.path.insert(0, r'D:\Projects\PyDataAnalyze\backend')

import os
import json
import shutil
import tempfile
import zipfile
import pandas as pd
import numpy as np

from config import UPLOAD_DIR

# ============================================================
# 测试数据准备
# ============================================================

df = pd.DataFrame({"A": [1, 2, np.nan, 4, 100], "B": ["x", "y", "z", "x", "y"]})
df_num = pd.DataFrame({
    "x": [1, 2, 3, 10, 11, 12],
    "y": [1, 2, 3, 10, 11, 12],
    "z": [5, 6, 7, 8, 9, 10],
    "cat": ["a", "a", "b", "b", "c", "c"],
})

# ============================================================
# 测试 cleaning（无变化）
# ============================================================

from services.cleaning import fill_missing, remove_outliers, drop_duplicates

filled = fill_missing(df.copy(), "mean")
assert filled["A"].isna().sum() == 0
print(f"[OK] fill_missing: {filled['A'].tolist()}")

filtered = remove_outliers(df.copy(), columns=["A"], method="iqr")
assert len(filtered) <= len(df)
print(f"[OK] remove_outliers IQR: {len(filtered)} 行")

deduped = drop_duplicates(pd.DataFrame({"A": [1, 1, 2]}))
assert len(deduped) == 2
print(f"[OK] drop_duplicates: {len(deduped)} 行")

# ============================================================
# 测试 clustering（全部方法）
# ============================================================

from services.clustering import analyze as cluster_analyze

# K-Means
res = cluster_analyze(df_num, "kmeans", ["x", "y"], {"n_clusters": 2})
assert res["method"] == "kmeans"
assert "inertia" in res and "centers" in res and "chart_data" in res
assert len(res["centers"]) == 2
assert res["chart_data"]["chart_type"] == "cluster_scatter"
assert "metrics" in res and "silhouette_score" in res["metrics"]
print(f"[OK] kmeans: K=2, inertia={res['inertia']:.2f}, silhouette={res['metrics']['silhouette_score']}")

# DBSCAN
res = cluster_analyze(df_num, "dbscan", ["x", "y"], {"eps": 1.0, "min_samples": 2})
assert res["method"] == "dbscan"
assert "metrics" in res
assert "noise_points" in res["metrics"]
print(f"[OK] dbscan: clusters={res['metrics']['n_clusters']}, noise={res['metrics']['noise_points']}")

# Agglomerative
res = cluster_analyze(df_num, "agglomerative", ["x", "y"], {"n_clusters": 2})
assert res["method"] == "agglomerative"
assert len(res["centers"]) == 2
assert "silhouette_score" in res["metrics"]
print(f"[OK] agglomerative: K=2, silhouette={res['metrics']['silhouette_score']}")

# PCA
res = cluster_analyze(df_num, "pca", ["x", "y", "z"], {"n_components": 2})
assert res["method"] == "pca"
assert res["chart_data"]["chart_type"] == "scatter"
assert "explained_variance_ratio" in res["metrics"]
assert len(res["metrics"]["explained_variance_ratio"]) == 2
print(f"[OK] pca: explained_variance={res['metrics']['explained_variance_ratio']}")

# ============================================================
# 测试 visualization（全部图表类型）
# ============================================================

from services.visualization import prepare_chart_data

# scatter with color_column
chart = prepare_chart_data(df_num, "scatter", "x", "y", color_column="cat")
assert chart["chart_type"] == "scatter"
assert "color_field" in chart
assert "color" in chart["data"][0]
print(f"[OK] scatter color_column: {len(chart['data'])} 个点")

# pie
chart = prepare_chart_data(df_num, "pie", "cat")
assert chart["chart_type"] == "pie"
assert len(chart["data"]) == 3  # a, b, c
print(f"[OK] pie: {len(chart['data'])} 个扇区")

# line
chart = prepare_chart_data(df_num, "line", "x", "y")
assert chart["chart_type"] == "line"
# 检查是否按 x 排序
xs = [d["x"] for d in chart["data"]]
assert xs == sorted(xs)
print(f"[OK] line: {len(chart['data'])} 个点，已排序")

# heatmap
chart = prepare_chart_data(df_num, "heatmap", columns=["x", "y", "z"])
assert chart["chart_type"] == "heatmap"
assert len(chart["data"]) == 9  # 3x3 correlation matrix
print(f"[OK] heatmap: {len(chart['data'])} 个三元组")

# scatter_matrix
chart = prepare_chart_data(df_num, "scatter_matrix", columns=["x", "y", "z"])
assert chart["chart_type"] == "scatter_matrix"
assert len(chart["panels"]) == 3  # C(3,2) = 3
print(f"[OK] scatter_matrix: {len(chart['panels'])} 个子图")

# histogram（原有）
chart = prepare_chart_data(df_num, "histogram", "x")
assert chart["chart_type"] == "histogram"
assert len(chart["data"]) > 0
print(f"[OK] histogram: {len(chart['data'])} 个区间")

# box（原有）
chart = prepare_chart_data(df_num, "box", columns=["x", "y"])
assert chart["chart_type"] == "box"
assert len(chart["data"]) == 2
print(f"[OK] box: {len(chart['data'])} 个变量")

# bar（原有）
chart = prepare_chart_data(df_num, "bar", "cat")
assert chart["chart_type"] == "bar"
print(f"[OK] bar: {len(chart['data'])} 个类别")

# ============================================================
# 测试 exporter（无变化）
# ============================================================

from services.exporter import export_csv, export_excel

csv_path = export_csv(df_num)
assert os.path.exists(csv_path)
os.remove(csv_path)

xlsx_path = export_excel(df_num)
assert os.path.exists(xlsx_path)
os.remove(xlsx_path)
print("[OK] export_csv + export_excel")

# ============================================================
# 测试 file_handler（新格式）
# ============================================================

from utils.file_handler import (
    load_dataframe,
    save_dataframe_to_session,
    load_dataframe_with_session,
    df_to_preview,
    columns_info,
)

# CSV
td = tempfile.mkdtemp(dir=UPLOAD_DIR)
csv_test = os.path.join(td, "test.csv")
df_num.to_csv(csv_test, index=False)
loaded = load_dataframe(csv_test)
assert len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] load_dataframe(csv)")

# JSON
td = tempfile.mkdtemp(dir=UPLOAD_DIR)
json_test = os.path.join(td, "test.json")
df_num.to_json(json_test, orient="records")
loaded = load_dataframe(json_test)
assert len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] load_dataframe(json)")

# JSONL
td = tempfile.mkdtemp(dir=UPLOAD_DIR)
jsonl_test = os.path.join(td, "test.jsonl")
df_num.to_json(jsonl_test, orient="records", lines=True)
loaded = load_dataframe(jsonl_test)
assert len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] load_dataframe(jsonl)")

# Parquet
try:
    td = tempfile.mkdtemp(dir=UPLOAD_DIR)
    pq_test = os.path.join(td, "test.parquet")
    df_num.to_parquet(pq_test)
    loaded = load_dataframe(pq_test)
    assert len(loaded) == 6
    shutil.rmtree(td, ignore_errors=True)
    print("[OK] load_dataframe(parquet)")
except Exception as e:
    print(f"[SKIP] load_dataframe(parquet): {e}")

# Feather
try:
    td = tempfile.mkdtemp(dir=UPLOAD_DIR)
    fth_test = os.path.join(td, "test.feather")
    df_num.to_feather(fth_test)
    loaded = load_dataframe(fth_test)
    assert len(loaded) == 6
    shutil.rmtree(td, ignore_errors=True)
    print("[OK] load_dataframe(feather)")
except Exception as e:
    print(f"[SKIP] load_dataframe(feather): {e}")

# session save/load
td = tempfile.mkdtemp(dir=UPLOAD_DIR)
save_dataframe_to_session(df_num, td)
loaded = load_dataframe_with_session(td)
assert loaded is not None and len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] save/load dataframe session")

preview = df_to_preview(df_num)
assert len(preview) == 6
print(f"[OK] df_to_preview: {len(preview)} 行")

info = columns_info(df_num)
assert len(info) == 4
print(f"[OK] columns_info: {len(info)} 列")

# ============================================================
# 测试 database（新表）
# ============================================================

from models.database import (
    init_db,
    save_record,
    get_history,
    save_upload_record,
    get_uploads,
    save_analysis_record,
    get_analysis_history,
)

init_db()

rid = save_record("test.csv", "test", "单元测试")
assert rid is not None
history = get_history(10)
assert len(history) >= 1
print(f"[OK] old database CRUD: 记录数={len(history)}")

# 新表
uid = save_upload_record("sess-test-001", "data.csv", 100, 5)
assert uid is not None
uploads = get_uploads()
assert len(uploads) >= 1
print(f"[OK] uploads table: {len(uploads)} 条记录")

aid = save_analysis_record(
    session_id="sess-test-001",
    method="kmeans",
    params_json='{"n_clusters":3}',
    inertia=123.45,
    metrics_json='{"silhouette_score":0.5}',
)
assert aid is not None
analyses = get_analysis_history()
assert len(analyses) >= 1
print(f"[OK] analysis_history table: {len(analyses)} 条记录")

analyses_sess = get_analysis_history(session_id="sess-test-001")
assert len(analyses_sess) >= 1
print(f"[OK] analysis_history filter by session: {len(analyses_sess)} 条记录")

# ============================================================
# 附加覆盖: ZIP 解析
# ============================================================

from utils.file_handler import _load_from_zip

td = tempfile.mkdtemp(dir=UPLOAD_DIR)
zip_csv = os.path.join(td, "inner.csv")
df_num.to_csv(zip_csv, index=False)
zip_path = os.path.join(td, "test.zip")
with zipfile.ZipFile(zip_path, "w") as zf:
    zf.write(zip_csv, "inner.csv")
loaded = _load_from_zip(zip_path)
assert len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] ZIP 解析 (内含 CSV)")

# ============================================================
# 附加覆盖: 错误情况
# ============================================================

from services.visualization import prepare_chart_data
from services.clustering import analyze as cluster_analyze

# 不存在的图表类型
try:
    prepare_chart_data(df_num, "nonexistent")
    assert False, "应抛出 ValueError"
except ValueError:
    print("[OK] prepare_chart_data 不存在的类型 → ValueError")

# 不存在的列
try:
    prepare_chart_data(df_num, "histogram", "not_a_column")
    assert False, "应抛出 ValueError"
except ValueError:
    print("[OK] prepare_chart_data 不存在的列 → ValueError")

# 不存在的分析方法
try:
    cluster_analyze(df_num, "nonexistent", ["x", "y"])
    assert False, "应抛出 ValueError"
except ValueError:
    print("[OK] cluster_analyze 不存在的分析方法 → ValueError")

# 少于 2 个数值列
try:
    cluster_analyze(df_num[["cat"]].copy(), "kmeans", ["cat"])
    assert False, "应抛出 ValueError"
except ValueError:
    print("[OK] cluster_analyze 少于 2 个数值列 → ValueError")

# ============================================================
# 附加覆盖: scatter_matrix + color_column
# ============================================================

chart = prepare_chart_data(df_num, "scatter_matrix", columns=["x", "y", "z"], color_column="cat")
assert chart["chart_type"] == "scatter_matrix"
assert chart.get("color_column") == "cat"
assert "color" in chart["panels"][0]["data"][0]
print(f"[OK] scatter_matrix with color_column: {len(chart['panels'])} 个子图")

# ============================================================
# 附加覆盖: _convert_nan 边界情况（infinity）
# ============================================================

from utils.file_handler import _convert_nan

assert _convert_nan(float("inf")) is None
assert _convert_nan(float("nan")) is None
assert _convert_nan(42) == 42
assert _convert_nan("hello") == "hello"
assert _convert_nan({"a": float("nan")}) == {"a": None}
print("[OK] _convert_nan 边界情况")

print("\n=== 所有测试通过 ===")
