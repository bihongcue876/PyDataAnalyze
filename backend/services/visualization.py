"""图表数据准备 — 匹配 share/protocol.md 第 4 节 ChartData 格式"""

import pandas as pd
import numpy as np


def prepare_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_column: str | None = None,
    y_column: str | None = None,
    columns: list[str] | None = None,
) -> dict:
    """
    根据图表类型返回可直接渲染的 ChartData 对象。

    支持的 chart_type:
      - histogram: 直方图（x_column 数值列分箱）
      - scatter:   散点图（x_column + y_column）
      - box:       箱线图（columns 多列并排，或 x_column 单列）
      - bar:       柱状图（x_column 分类 + 可选 y_column 聚合均值）
    """
    if chart_type == "histogram":
        return _histogram(df, x_column)
    elif chart_type == "scatter":
        return _scatter(df, x_column, y_column)
    elif chart_type == "box":
        return _box(df, columns or [x_column])
    elif chart_type == "bar":
        return _bar(df, x_column, y_column)
    else:
        raise ValueError(f"不支持的图表类型: {chart_type}")


def _histogram(df: pd.DataFrame, col: str | None) -> dict:
    if not col or col not in df.columns:
        raise ValueError(f"列 '{col}' 不存在")
    data = df[col].dropna()
    if data.empty:
        raise ValueError(f"列 '{col}' 无有效数据")

    counts, edges = np.histogram(data, bins="auto")
    bins = [
        {"label": f"{edges[i]:.1f}–{edges[i+1]:.1f}", "value": int(counts[i])}
        for i in range(len(counts))
    ]
    return {
        "chart_type": "histogram",
        "data": bins,
        "x_label": str(col),
        "y_label": "Frequency",
        "title": f"{col} 分布",
    }


def _scatter(df: pd.DataFrame, x_col: str | None, y_col: str | None) -> dict:
    if not x_col or not y_col:
        raise ValueError("散点图需要 x_column 和 y_column")
    if x_col not in df.columns:
        raise ValueError(f"列 '{x_col}' 不存在")
    if y_col not in df.columns:
        raise ValueError(f"列 '{y_col}' 不存在")

    plot_data = df[[x_col, y_col]].dropna()
    return {
        "chart_type": "scatter",
        "data": [
            {"x": float(r[x_col]), "y": float(r[y_col])}
            for _, r in plot_data.iterrows()
        ],
        "x_label": str(x_col),
        "y_label": str(y_col),
        "title": f"{x_col} vs {y_col}",
    }


def _box(df: pd.DataFrame, cols: list[str] | None) -> dict:
    if not cols:
        raise ValueError("箱线图需要指定 columns")
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"列不存在: {missing}")

    data = []
    for col in cols:
        values = df[col].dropna()
        q1 = values.quantile(0.25)
        q3 = values.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        outliers = values[(values < lower) | (values > upper)].tolist()
        inside = values[(values >= lower) & (values <= upper)]
        data.append({
            "label": str(col),
            "min": float(inside.min()) if not inside.empty else float(values.min()),
            "q1": float(q1),
            "median": float(values.median()),
            "q3": float(q3),
            "max": float(inside.max()) if not inside.empty else float(values.max()),
            "outliers": [float(v) for v in outliers],
        })

    return {
        "chart_type": "box",
        "data": data,
        "y_label": cols[0] if len(cols) == 1 else "",
        "title": "箱线图",
    }


def _bar(df: pd.DataFrame, x_col: str | None, y_col: str | None = None) -> dict:
    if not x_col or x_col not in df.columns:
        raise ValueError(f"列 '{x_col}' 不存在")

    if y_col:
        # 分组聚合均值
        grouped = df.groupby(x_col, observed=True)[y_col].mean().reset_index()
        data = [
            {"label": str(r[x_col]), "value": float(r[y_col])}
            for _, r in grouped.iterrows()
        ]
    else:
        # 统计频次
        counts = df[x_col].value_counts()
        data = [
            {"label": str(k), "value": int(v)}
            for k, v in counts.items()
        ]

    return {
        "chart_type": "bar",
        "data": data,
        "x_label": str(x_col),
        "y_label": y_col if y_col else "Count",
        "title": f"{x_col} 分布" if not y_col else f"{x_col} vs {y_col}（均值）",
    }
