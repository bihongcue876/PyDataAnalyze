"""数据清洗功能"""

import pandas as pd
import numpy as np


def fill_missing(df: pd.DataFrame, strategy: str = "mean") -> pd.DataFrame:
    """填充缺失值"""
    df = df.copy()
    numeric_cols = df.select_dtypes(include=[np.number]).columns

    if strategy == "mean":
        for col in numeric_cols:
            df[col] = df[col].fillna(df[col].mean())
    elif strategy == "median":
        for col in numeric_cols:
            df[col] = df[col].fillna(df[col].median())
    elif strategy == "mode":
        for col in df.columns:
            if not df[col].mode().empty:
                df[col] = df[col].fillna(df[col].mode()[0])
    elif strategy == "drop":
        df = df.dropna()

    return df


def remove_outliers(
    df: pd.DataFrame,
    columns: list[str] | None = None,
    method: str = "iqr",
) -> pd.DataFrame:
    """移除异常值（支持多列联合过滤）"""
    df = df.copy()

    if not columns:
        # 空列表 = 对所有数值列检测
        columns = df.select_dtypes(include=[np.number]).columns.tolist()

    mask = pd.Series(True, index=df.index)
    for col in columns:
        if col not in df.columns:
            continue

        if method == "iqr":
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            mask &= (df[col] >= lower) & (df[col] <= upper)

        elif method == "zscore":
            from scipy import stats
            z = np.abs(stats.zscore(df[col].dropna()))
            threshold = 3
            valid_idx = df[col].dropna().index[z < threshold]
            col_mask = pd.Series(False, index=df.index)
            col_mask[valid_idx] = True
            mask &= col_mask

    return df[mask].reset_index(drop=True)


def drop_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """删除重复行"""
    return df.drop_duplicates().reset_index(drop=True)
