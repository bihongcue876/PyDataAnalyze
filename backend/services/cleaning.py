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


def remove_outliers(df: pd.DataFrame, column: str, method: str = "iqr") -> pd.DataFrame:
    """移除异常值"""
    df = df.copy()

    if column not in df.columns:
        return df

    if method == "iqr":
        Q1 = df[column].quantile(0.25)
        Q3 = df[column].quantile(0.75)
        IQR = Q3 - Q1
        lower = Q1 - 1.5 * IQR
        upper = Q3 + 1.5 * IQR
        return df[(df[column] >= lower) & (df[column] <= upper)]

    elif method == "zscore":
        from scipy import stats
        z_scores = np.abs(stats.zscore(df[column].dropna()))
        threshold = 3
        mask = pd.Series(False, index=df.index)
        valid_idx = df[column].dropna().index[z_scores < threshold]
        mask[valid_idx] = True
        return df[mask]

    return df


def drop_duplicates(df: pd.DataFrame) -> pd.DataFrame:
    """删除重复行"""
    return df.drop_duplicates().reset_index(drop=True)
