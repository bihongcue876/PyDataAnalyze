"""后端功能快速测试"""
import sys
sys.path.insert(0, r'D:\Projects\PyDataAnalyze\backend')

import os
import pandas as pd
import numpy as np

# 清除遗留测试文件
from config import EXPORT_DIR

# --- 测试 cleaning ---
from services.cleaning import fill_missing, remove_outliers, drop_duplicates

df = pd.DataFrame({'A': [1, 2, None, 4, 100], 'B': ['x', 'y', 'z', 'x', 'y']})
filled = fill_missing(df.copy(), 'mean')
assert filled['A'].isna().sum() == 0, "fill_missing 未填充所有缺失值"
print(f'[OK] fill_missing: {filled["A"].tolist()}')

filtered = remove_outliers(df.copy(), 'A', 'iqr')
assert len(filtered) <= len(df), "remove_outliers 未正确剔除"
print(f'[OK] remove_outliers IQR: {len(filtered)} 行 (原始 {len(df)} 行)')

deduped = drop_duplicates(pd.DataFrame({'A': [1, 1, 2]}))
assert len(deduped) == 2, "drop_duplicates 未正确去重"
print(f'[OK] drop_duplicates: {len(deduped)} 行')

# --- 测试 clustering ---
from services.clustering import kmeans_cluster

df2 = pd.DataFrame({'x': [1, 2, 3, 10, 11, 12], 'y': [1, 2, 3, 10, 11, 12]})
res = kmeans_cluster(df2, ['x', 'y'], 2)
assert 'labels' in res and 'centers' in res
assert len(set(res['labels'])) == 2
print(f'[OK] kmeans_cluster: K=2, 标签唯一值={len(set(res["labels"]))}')

# --- 测试 visualization ---
from services.visualization import prepare_chart_data

chart = prepare_chart_data(df2, 'scatter', 'x', 'y')
assert len(chart['x']) == 6
print(f'[OK] prepare_chart_data(scatter): {len(chart["x"])} 个点')

chart2 = prepare_chart_data(df2, 'pie', 'x')
assert 'labels' in chart2 and 'values' in chart2
print(f'[OK] prepare_chart_data(pie): {len(chart2["labels"])} 个类别')

# --- 测试 exporter ---
from services.exporter import export_csv, export_excel

csv_path = export_csv(df2)
assert os.path.exists(csv_path)
os.remove(csv_path)

xlsx_path = export_excel(df2)
assert os.path.exists(xlsx_path)
os.remove(xlsx_path)
print(f'[OK] export_csv + export_excel')

# --- 测试 file_handler ---
from utils.file_handler import load_dataframe, save_dataframe_to_session, load_dataframe_with_session
import tempfile
from config import UPLOAD_DIR

td = tempfile.mktemp(dir=UPLOAD_DIR)
save_dataframe_to_session(df2, td)
loaded = load_dataframe_with_session(td)
assert loaded is not None and len(loaded) == 6
import shutil; shutil.rmtree(td, ignore_errors=True)
print(f'[OK] save/load dataframe session')

# --- 测试 database ---
from models.database import init_db, save_record, get_history
init_db()
rid = save_record('test.csv', 'test', '单元测试')
assert rid is not None
history = get_history(10)
assert len(history) >= 1
print(f'[OK] database CRUD: 记录数={len(history)}')

print('\n=== 所有测试通过 ===')
