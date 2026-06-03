"""应用配置"""

import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 上传文件存储目录
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# SQLite 数据库（相对路径，运行时自动创建）
DB_PATH = str(BASE_DIR / "backend" / "pydata.db")

# 允许上传的文件扩展名
ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".xls"}

# 导出目录
EXPORT_DIR = BASE_DIR / "data" / "exports"
os.makedirs(EXPORT_DIR, exist_ok=True)
