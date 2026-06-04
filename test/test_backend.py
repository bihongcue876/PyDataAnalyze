"""后端功能快速测试"""
import sys
sys.path.insert(0, r'D:\Projects\PyDataAnalyze\backend')

import os
import shutil
import tempfile
import pandas as pd
import numpy as np

from config import UPLOAD_DIR

# --- 测试 cleaning ---
from services.cleaning import fill_missing, remove_outliers, drop_duplicates

df = pd.DataFrame({"A": [1, 2, None, 4, 100], "B": ["x", "y", "z", "x", "y"]})
filled = fill_missing(df.copy(), "mean")
assert filled["A"].isna().sum() == 0, "fill_missing 未填充所有缺失值"
print(f"[OK] fill_missing: {filled['A'].tolist()}")

filtered = remove_outliers(df.copy(), columns=["A"], method="iqr")
assert len(filtered) <= len(df), "remove_outliers 未正确剔除"
print(f"[OK] remove_outliers IQR: {len(filtered)} 行 (原始 {len(df)} 行)")

deduped = drop_duplicates(pd.DataFrame({"A": [1, 1, 2]}))
assert len(deduped) == 2, "drop_duplicates 未正确去重"
print(f"[OK] drop_duplicates: {len(deduped)} 行")

# --- 测试 clustering ---
from services.clustering import kmeans_analyze

df2 = pd.DataFrame({"x": [1, 2, 3, 10, 11, 12], "y": [1, 2, 3, 10, 11, 12]})
res = kmeans_analyze(df2, ["x", "y"], 2)
assert "inertia" in res and "centers" in res and "chart_data" in res
assert len(res["centers"]) == 2
print(f"[OK] kmeans_analyze: K=2, inertia={res['inertia']:.2f}")

# --- 测试 visualization ---
from services.visualization import prepare_chart_data

chart = prepare_chart_data(df2, "scatter", "x", "y")
assert chart["chart_type"] == "scatter"
assert len(chart["data"]) == 6
print(f"[OK] prepare_chart_data(scatter): {len(chart['data'])} 个点")

chart2 = prepare_chart_data(df2, "bar", "x")
assert chart2["chart_type"] == "bar"
assert len(chart2["data"]) == 6
print(f"[OK] prepare_chart_data(bar): {len(chart2['data'])} 个类别")

chart3 = prepare_chart_data(df2, "histogram", "x")
assert chart3["chart_type"] == "histogram"
assert len(chart3["data"]) > 0
print(f"[OK] prepare_chart_data(histogram): {len(chart3['data'])} 个区间")

chart4 = prepare_chart_data(df2, "box", columns=["x", "y"])
assert chart4["chart_type"] == "box"
assert len(chart4["data"]) == 2
print(f"[OK] prepare_chart_data(box): {len(chart4['data'])} 个变量")

# --- 测试 exporter ---
from services.exporter import export_csv, export_excel

csv_path = export_csv(df2)
assert os.path.exists(csv_path)
os.remove(csv_path)

xlsx_path = export_excel(df2)
assert os.path.exists(xlsx_path)
os.remove(xlsx_path)
print("[OK] export_csv + export_excel")

# --- 测试 file_handler ---
from utils.file_handler import (
    load_dataframe,
    save_dataframe_to_session,
    load_dataframe_with_session,
    df_to_preview,
    columns_info,
)

td = tempfile.mktemp(dir=UPLOAD_DIR)
save_dataframe_to_session(df2, td)
loaded = load_dataframe_with_session(td)
assert loaded is not None and len(loaded) == 6
shutil.rmtree(td, ignore_errors=True)
print("[OK] save/load dataframe session")

preview = df_to_preview(df2)
assert len(preview) == 6
print(f"[OK] df_to_preview: {len(preview)} 行")

info = columns_info(df2)
assert len(info) == 2
print(f"[OK] columns_info: {len(info)} 列")

# --- 测试 database ---
from models.database import init_db, save_record, get_history

init_db()
rid = save_record("test.csv", "test", "单元测试")
assert rid is not None
history = get_history(10)
assert len(history) >= 1
print(f"[OK] database CRUD: 记录数={len(history)}")

print("\n=== 所有测试通过 ===")
