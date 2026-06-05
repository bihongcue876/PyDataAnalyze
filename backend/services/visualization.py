"""图表数据准备 — 匹配 share/protocol.md v1.1 §4 ChartData 格式"""

import itertools

import numpy as np
import pandas as pd


def prepare_chart_data(
    df: pd.DataFrame,
    chart_type: str,
    x_column: str | None = None,
    y_column: str | None = None,
    columns: list[str] | None = None,
    color_column: str | None = None,
) -> dict:
    """
    根据图表类型返回可直接渲染的 ChartData 对象。

    支持 chart_type:
      - histogram / scatter / box / bar（原有）
      - pie / line / heatmap / scatter_matrix（v1.1 新增）
    """
    dispatch = {
        "histogram": _histogram,
        "scatter": _scatter,
        "box": _box,
        "bar": _bar,
        "pie": _pie,
        "line": _line,
        "heatmap": _heatmap,
        "scatter_matrix": _scatter_matrix,
    }
    func = dispatch.get(chart_type)
    if func is None:
        raise ValueError(f"不支持的图表类型: {chart_type}")

    kwargs = {
        "df": df,
        "x_column": x_column,
        "y_column": y_column,
        "columns": columns,
        "color_column": color_column,
    }
    return func(**kwargs)


# ============================================================
# 原有图表类型
# ============================================================

def _histogram(df: pd.DataFrame, x_column: str | None = None, **kw) -> dict:
    col = x_column
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


def _scatter(df: pd.DataFrame, x_column: str | None = None,
             y_column: str | None = None,
             color_column: str | None = None, **kw) -> dict:
    if not x_column or not y_column:
        raise ValueError("散点图需要 x_column 和 y_column")
    if x_column not in df.columns:
        raise ValueError(f"列 '{x_column}' 不存在")
    if y_column not in df.columns:
        raise ValueError(f"列 '{y_column}' 不存在")

    plot_data = df[[x_column, y_column]].dropna()
    data = [
        {"x": float(r[x_column]), "y": float(r[y_column])}
        for _, r in plot_data.iterrows()
    ]

    result = {
        "chart_type": "scatter",
        "data": data,
        "x_label": str(x_column),
        "y_label": str(y_column),
        "title": f"{x_column} vs {y_column}",
    }

    if color_column and color_column in df.columns:
        merged = df[[x_column, y_column, color_column]].dropna()
        data = [
            {"x": float(r[x_column]), "y": float(r[y_column]),
             "color": int(r[color_column]) if isinstance(r[color_column], (int, np.integer))
             else str(r[color_column])}
            for _, r in merged.iterrows()
        ]
        return {
            "chart_type": "scatter",
            "data": data,
            "x_label": str(x_column),
            "y_label": str(y_column),
            "title": f"{x_column} vs {y_column}",
            "color_field": color_column,
        }

    return result


def _box(df: pd.DataFrame, columns: list[str] | None = None,
         x_column: str | None = None, **kw) -> dict:
    cols = columns or ([x_column] if x_column else None)
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


def _bar(df: pd.DataFrame, x_column: str | None = None,
         y_column: str | None = None, **kw) -> dict:
    if not x_column or x_column not in df.columns:
        raise ValueError(f"列 '{x_column}' 不存在")

    if y_column:
        grouped = df.groupby(x_column, observed=True)[y_column].mean().reset_index()
        data = [
            {"label": str(r[x_column]), "value": float(r[y_column])}
            for _, r in grouped.iterrows()
        ]
    else:
        counts = df[x_column].value_counts()
        data = [
            {"label": str(k), "value": int(v)}
            for k, v in counts.items()
        ]

    return {
        "chart_type": "bar",
        "data": data,
        "x_label": str(x_column),
        "y_label": y_column if y_column else "Count",
        "title": f"{x_column} 分布" if not y_column else f"{x_column} vs {y_column}（均值）",
    }


# ============================================================
# 新增图表类型（protocol v1.1）
# ============================================================

def _pie(df: pd.DataFrame, x_column: str | None = None, **kw) -> dict:
    """饼图：对 x_column 统计频次"""
    if not x_column or x_column not in df.columns:
        raise ValueError(f"饼图需要 x_column，且列 '{x_column}' 不存在")

    counts = df[x_column].value_counts()
    data = [
        {"label": str(k), "value": int(v)}
        for k, v in counts.items()
    ]
    return {
        "chart_type": "pie",
        "data": data,
        "title": f"{x_column} 分布",
    }


def _line(df: pd.DataFrame, x_column: str | None = None,
          y_column: str | None = None, **kw) -> dict:
    """折线图：与 scatter 数据结构相同，但按 x_column 排序"""
    if not x_column or not y_column:
        raise ValueError("折线图需要 x_column 和 y_column")
    if x_column not in df.columns:
        raise ValueError(f"列 '{x_column}' 不存在")
    if y_column not in df.columns:
        raise ValueError(f"列 '{y_column}' 不存在")

    plot_data = df[[x_column, y_column]].dropna().sort_values(by=x_column)
    data = [
        {"x": float(r[x_column]), "y": float(r[y_column])}
        for _, r in plot_data.iterrows()
    ]
    return {
        "chart_type": "line",
        "data": data,
        "x_label": str(x_column),
        "y_label": str(y_column),
        "title": f"{x_column} vs {y_column}",
    }


def _heatmap(df: pd.DataFrame, columns: list[str] | None = None, **kw) -> dict:
    """热力图：对 columns 中的数值列计算相关性矩阵"""
    if not columns:
        raise ValueError("热力图需要指定 columns")
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"列不存在: {missing}")

    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    if len(numeric_cols) < 2:
        raise ValueError("热力图至少需要 2 个数值列")

    corr = df[numeric_cols].corr()
    data = []
    for x_col in numeric_cols:
        for y_col in numeric_cols:
            val = corr.loc[x_col, y_col]
            if pd.notna(val):
                data.append({
                    "x": x_col,
                    "y": y_col,
                    "value": float(val),
                })

    return {
        "chart_type": "heatmap",
        "data": data,
        "x_label": "变量",
        "y_label": "变量",
        "title": "相关性热力图",
    }


def _scatter_matrix(df: pd.DataFrame, columns: list[str] | None = None,
                    color_column: str | None = None, **kw) -> dict:
    """散点矩阵：对 columns 中的列两两组合"""
    if not columns or len(columns) < 2:
        raise ValueError("散点矩阵至少需要 2 个列")
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"列不存在: {missing}")

    numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
    if len(numeric_cols) < 2:
        raise ValueError("散点矩阵至少需要 2 个数值列")

    panels = []
    for x_col, y_col in itertools.combinations(numeric_cols, 2):
        plot_data = df[[x_col, y_col]].dropna()
        panel = {
            "x_col": x_col,
            "y_col": y_col,
            "data": [
                {"x": float(r[x_col]), "y": float(r[y_col])}
                for _, r in plot_data.iterrows()
            ],
        }

        if color_column and color_column in df.columns:
            colored = df[[x_col, y_col, color_column]].dropna()
            panel["data"] = [
                {"x": float(r[x_col]), "y": float(r[y_col]),
                 "color": int(r[color_column]) if isinstance(r[color_column], (int, np.integer))
                 else str(r[color_column])}
                for _, r in colored.iterrows()
            ]

        panels.append(panel)

    result = {
        "chart_type": "scatter_matrix",
        "panels": panels,
        "title": "散点矩阵",
    }
    if color_column:
        result["color_column"] = color_column

    return result
