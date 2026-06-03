"""图表数据准备"""

import pandas as pd


def prepare_chart_data(df: pd.DataFrame, chart_type: str, x_column: str, y_column: str = "") -> dict:
    """
    根据图表类型准备图表数据

    支持：bar(柱状图), line(折线图), scatter(散点图), pie(饼图)
    """
    if x_column not in df.columns:
        raise ValueError(f"列 '{x_column}' 不存在")

    if chart_type == "pie":
        # 饼图：x_column 为分类，统计频次
        value_counts = df[x_column].value_counts()
        return {
            "chart_type": "pie",
            "labels": value_counts.index.tolist(),
            "values": value_counts.values.tolist(),
        }

    if y_column and y_column not in df.columns:
        raise ValueError(f"列 '{y_column}' 不存在")

    if chart_type == "scatter":
        if not y_column:
            raise ValueError("散点图需要指定 y_column")
        # 去除缺失
        plot_data = df[[x_column, y_column]].dropna()
        return {
            "chart_type": "scatter",
            "x": plot_data[x_column].tolist(),
            "y": plot_data[y_column].tolist(),
        }

    # bar / line：如果给了 y_column 则聚合，否则统计频次
    if y_column:
        grouped = df.groupby(x_column)[y_column].mean().reset_index()
        return {
            "chart_type": chart_type,
            "labels": grouped[x_column].astype(str).tolist(),
            "values": grouped[y_column].tolist(),
        }
    else:
        counts = df[x_column].value_counts()
        return {
            "chart_type": chart_type,
            "labels": counts.index.astype(str).tolist(),
            "values": counts.values.tolist(),
        }
