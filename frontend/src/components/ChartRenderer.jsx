import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";

/**
 * ChartRenderer —— 共享图表渲染组件
 *
 * 接收协议定义的 ChartData 对象（discriminated union），
 * 根据 chart_type 自动构建 ECharts option 并渲染。
 *
 * 支持图表类型：
 *   histogram | scatter | box | bar | cluster_scatter | pie | line | heatmap | scatter_matrix
 *
 * Props:
 *   chartData — 协议 ChartData 对象
 *   height    — 图表高度 (px)，默认 420
 */

/** 配色调色板 */
const CLUSTER_PALETTE = [
  "#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de",
  "#3ba272", "#fc8452", "#9a60b4", "#ea7ccc", "#48b8d0",
];

// ============================================================
// 各图表类型 → ECharts option 转换函数
// ============================================================

function buildHistogramOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || "直方图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      name: x_label || "",
      axisLabel: { rotate: data.length > 8 ? 30 : 0 },
    },
    yAxis: { type: "value", name: y_label || "频数" },
    series: [{
      type: "bar",
      data: data.map((d) => d.value),
      itemStyle: { color: "#5470c6", borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: "#3a5bb5" } },
    }],
    grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
  };
}

function buildScatterOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  const colorField = chartData.color_field;

  let series;
  if (colorField && data.length > 0 && "color" in data[0]) {
    // 按 color 分组
    const groups = {};
    for (const p of data) {
      const k = String(p.color);
      if (!groups[k]) groups[k] = [];
      groups[k].push([p.x, p.y]);
    }
    const keys = Object.keys(groups).sort();
    series = keys.map((k) => ({
      name: `${colorField}=${k}`,
      type: "scatter",
      data: groups[k],
      symbolSize: 8,
    }));
  } else {
    series = [{
      type: "scatter",
      data: data.map((d) => [d.x, d.y]),
      symbolSize: 8,
      itemStyle: { color: "#5470c6", opacity: 0.7 },
    }];
  }

  return {
    title: { text: title || "散点图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: "item",
      formatter: (params) =>
        `${x_label || "X"}: ${params.value[0]}<br/>${y_label || "Y"}: ${params.value[1]}`,
    },
    legend: series.length > 1 ? { bottom: 0 } : undefined,
    xAxis: { type: "value", name: x_label || "" },
    yAxis: { type: "value", name: y_label || "" },
    series,
    grid: { left: "3%", right: "4%", bottom: series.length > 1 ? "12%" : "10%", containLabel: true },
  };
}

function buildBoxOption(chartData) {
  const { data, x_label, y_label, title } = chartData;

  return {
    title: { text: title || "箱线图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const d = data[params.dataIndex];
        if (!d) return "";
        return `<strong>${d.label}</strong><br/>
          最小值: ${d.min}<br/>
          Q1: ${d.q1}<br/>
          中位数: ${d.median}<br/>
          Q3: ${d.q3}<br/>
          最大值: ${d.max}<br/>
          异常值: ${d.outliers?.join(", ") || "无"}`;
      },
    },
    xAxis: { type: "category", data: data.map((d) => d.label), name: x_label || "" },
    yAxis: { type: "value", name: y_label || "值" },
    series: [
      {
        type: "boxplot",
        data: data.map((d) => [d.min, d.q1, d.median, d.q3, d.max]),
        itemStyle: { color: "#5470c6", borderColor: "#3a5bb5" },
      },
      {
        type: "scatter",
        data: data.flatMap((d, idx) => (d.outliers || []).map((o) => [idx, o])),
        symbolSize: 6,
        itemStyle: { color: "#ee6666" },
        tooltip: { formatter: (params) => `异常值: ${params.value[1]}` },
      },
    ],
    grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
  };
}

function buildBarOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || "柱状图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      name: x_label || "",
      axisLabel: { rotate: data.length > 8 ? 30 : 0, interval: 0 },
    },
    yAxis: { type: "value", name: y_label || "" },
    series: [{
      type: "bar",
      data: data.map((d) => d.value),
      itemStyle: { color: "#91cc75", borderRadius: [4, 4, 0, 0] },
    }],
    grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
  };
}

function buildClusterScatterOption(chartData) {
  const { data, x_label, y_label, title } = chartData;

  const clusters = {};
  for (const point of data) {
    const c = point.cluster;
    if (!clusters[c]) clusters[c] = [];
    clusters[c].push([point.x, point.y]);
  }

  const clusterIds = Object.keys(clusters).sort((a, b) => Number(a) - Number(b));

  return {
    title: { text: title || "聚类结果", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: "item",
      formatter: (params) =>
        `簇 ${params.seriesName}<br/>${x_label || "X"}: ${params.value[0]}<br/>${y_label || "Y"}: ${params.value[1]}`,
    },
    legend: { data: clusterIds.map((c) => `簇 ${c}`), bottom: 0 },
    xAxis: { type: "value", name: x_label || "" },
    yAxis: { type: "value", name: y_label || "" },
    series: clusterIds.map((clusterId, idx) => ({
      name: `簇 ${clusterId}`,
      type: "scatter",
      data: clusters[clusterId],
      symbolSize: 7,
      itemStyle: { color: CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length], opacity: 0.75 },
    })),
    grid: { left: "3%", right: "4%", bottom: "12%", containLabel: true },
  };
}

// ============================================================
// 新增图表类型（protocol v1.1）
// ============================================================

function buildPieOption(chartData) {
  const { data, title } = chartData;
  return {
    title: { text: title || "饼图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => `${params.name}: ${params.value} (${params.percent}%)`,
    },
    series: [{
      type: "pie",
      radius: ["30%", "60%"],
      center: ["50%", "50%"],
      data: data.map((d) => ({ name: d.label, value: d.value })),
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: "rgba(0, 0, 0, 0.5)" },
      },
      label: { formatter: "{b}: {d}%" },
    }],
  };
}

function buildLineOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || "折线图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", name: x_label || "" },
    yAxis: { type: "value", name: y_label || "" },
    series: [{
      type: "line",
      data: data.map((d) => [d.x, d.y]),
      smooth: true,
      symbolSize: 6,
      lineStyle: { width: 2, color: "#5470c6" },
      itemStyle: { color: "#5470c6" },
      areaStyle: { color: "rgba(84, 112, 198, 0.1)" },
    }],
    grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
  };
}

function buildHeatmapOption(chartData) {
  const { data, title } = chartData;

  // 提取行列标签
  const xLabels = [...new Set(data.map((d) => d.x))];
  const yLabels = [...new Set(data.map((d) => d.y))];

  const heatData = data.map((d) => [xLabels.indexOf(d.x), yLabels.indexOf(d.y), d.value]);

  return {
    title: { text: title || "相关性热力图", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      formatter: (params) =>
        `${yLabels[params.value[1]]} × ${xLabels[params.value[0]]}<br/>相关系数: ${params.value[2]}`,
    },
    xAxis: {
      type: "category",
      data: xLabels,
      splitArea: { show: true },
      axisLabel: { rotate: 30 },
    },
    yAxis: {
      type: "category",
      data: yLabels,
      splitArea: { show: true },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      inRange: { color: ["#313695", "#4575b4", "#74add1", "#abd9e9", "#fee090", "#fdae61", "#f46d43", "#d73027"] },
    },
    series: [{
      type: "heatmap",
      data: heatData,
      label: {
        show: true,
        formatter: (params) => params.value[2].toFixed(2),
        fontSize: 11,
      },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowColor: "rgba(0, 0, 0, 0.5)" },
      },
    }],
    grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
  };
}

function buildScatterMatrixOption(chartData) {
  const { panels, title } = chartData;
  const n = panels.length;

  // 每个子图用独立的 grid
  const cols = Math.min(3, n);
  const rows = Math.ceil(n / cols);

  const options = {
    title: { text: title || "散点矩阵", left: "center", textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: "item",
      formatter: (params) => `${params.seriesName}<br/>X: ${params.value[0]}<br/>Y: ${params.value[1]}`,
    },
    grid: panels.map((_, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      return {
        left: `${(col / cols) * 100 + 2}%`,
        top: `${(row / rows) * 100 + 5}%`,
        width: `${(100 / cols) - 4}%`,
        height: `${(100 / rows) - 6}%`,
        containLabel: false,
      };
    }),
    xAxis: panels.map((p) => ({
      type: "value",
      name: p.x_col,
      nameLocation: "center",
      nameGap: 20,
      gridIndex: panels.indexOf(p),
      splitLine: { show: false },
      axisLabel: { show: false },
    })),
    yAxis: panels.map((p) => ({
      type: "value",
      name: p.y_col,
      nameLocation: "center",
      nameGap: 25,
      gridIndex: panels.indexOf(p),
      splitLine: { show: false },
      axisLabel: { show: false },
    })),
    series: panels.map((p, idx) => ({
      name: `${p.x_col} × ${p.y_col}`,
      type: "scatter",
      data: p.data.map((d) => [d.x, d.y]),
      xAxisIndex: idx,
      yAxisIndex: idx,
      symbolSize: 5,
      itemStyle: { opacity: 0.6 },
    })),
  };

  return options;
}

// ============================================================
// 路由表
// ============================================================

const BUILDERS = {
  histogram: buildHistogramOption,
  scatter: buildScatterOption,
  box: buildBoxOption,
  bar: buildBarOption,
  cluster_scatter: buildClusterScatterOption,
  pie: buildPieOption,
  line: buildLineOption,
  heatmap: buildHeatmapOption,
  scatter_matrix: buildScatterMatrixOption,
};

// ============================================================
// 组件
// ============================================================

function ChartRenderer({ chartData, height = 420 }) {
  const option = useMemo(() => {
    if (!chartData || !chartData.chart_type) return null;

    const builder = BUILDERS[chartData.chart_type];
    if (!builder) {
      console.warn(`ChartRenderer: 不支持的图表类型 "${chartData.chart_type}"`);
      return null;
    }

    return builder(chartData);
  }, [chartData]);

  if (!option) {
    return <div className="chart-placeholder">暂无图表数据</div>;
  }

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: "100%" }}
        notMerge={true}
        lazyUpdate={true}
        opts={{ locale: "ZH" }}
      />
    </div>
  );
}

export default ChartRenderer;
