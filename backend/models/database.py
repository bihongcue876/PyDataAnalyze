"""SQLite 数据库管理 — 与 share/protocol.md v1.1 一致"""

import datetime
import sqlite3

from config import DB_PATH


def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库表"""
    conn = get_connection()
    cursor = conn.cursor()

    # 旧表（向后兼容，用于简单操作日志）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT NOT NULL,
            operation TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL
        )
    """)

    # 上传历史表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS uploads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            upload_time TEXT NOT NULL,
            rows INTEGER NOT NULL,
            cols INTEGER NOT NULL
        )
    """)

    # 分析历史表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            method TEXT NOT NULL,
            params_json TEXT NOT NULL DEFAULT '{}',
            inertia REAL,
            metrics_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_id) REFERENCES uploads(session_id)
        )
    """)

    conn.commit()
    conn.close()


# ============================================================
# 旧版记录（向后兼容）
# ============================================================

def save_record(filename: str, operation: str, details: str = ""):
    """保存操作记录（旧版）"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO analysis_records (filename, operation, details, created_at) VALUES (?, ?, ?, ?)",
        (filename, operation, details, datetime.datetime.now().isoformat()),
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return record_id


def get_history(limit: int = 50):
    """获取历史记录（旧版）"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM analysis_records ORDER BY created_at DESC LIMIT ?", (limit,)
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


# ============================================================
# 新版记录（protocol v1.1）
# ============================================================

def save_upload_record(session_id: str, filename: str, rows: int, cols: int) -> int:
    """保存上传记录到 uploads 表"""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()
    cursor.execute(
        "INSERT OR REPLACE INTO uploads (session_id, filename, upload_time, rows, cols) VALUES (?, ?, ?, ?, ?)",
        (session_id, filename, now, rows, cols),
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return record_id


def save_analysis_record(session_id: str, method: str, params_json: str,
                         inertia: float | None = None,
                         metrics_json: str = "{}") -> int:
    """保存分析记录到 analysis_history 表"""
    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.datetime.now().isoformat()
    cursor.execute(
        """INSERT INTO analysis_history
           (session_id, method, params_json, inertia, metrics_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (session_id, method, params_json, inertia, metrics_json, now),
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return record_id


def get_uploads(limit: int = 100, offset: int = 0) -> list[dict]:
    """获取上传历史"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM uploads ORDER BY upload_time DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_analysis_history(session_id: str | None = None,
                         limit: int = 100, offset: int = 0) -> list[dict]:
    """获取分析历史"""
    conn = get_connection()
    cursor = conn.cursor()
    if session_id:
        cursor.execute(
            """SELECT * FROM analysis_history
               WHERE session_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?""",
            (session_id, limit, offset),
        )
    else:
        cursor.execute(
            "SELECT * FROM analysis_history ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows
