import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

/**
 * ChartRenderer —— 共享图表渲染组件
 *
 * 接收协议定义的 ChartData 对象（discriminated union），
 * 根据 chart_type 自动构建 ECharts option 并渲染。
 *
 * 支持图表类型：
 *   histogram | scatter | box | bar | cluster_scatter
 *
 * Props:
 *   chartData — 协议 ChartData 对象
 *   height    — 图表高度 (px)，默认 420
 */

/** 聚类颜色调色板（10 种颜色，足够 K ≤ 10） */
const CLUSTER_PALETTE = [
  '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
  '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#48b8d0',
];

// ============================================================
// 各图表类型 → ECharts option 转换函数
// ============================================================

function buildHistogramOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || '直方图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      name: x_label || '',
      axisLabel: { rotate: data.length > 8 ? 30 : 0 },
    },
    yAxis: {
      type: 'value',
      name: y_label || '频数',
    },
    series: [{
      type: 'bar',
      data: data.map((d) => d.value),
      itemStyle: { color: '#5470c6', borderRadius: [4, 4, 0, 0] },
      emphasis: { itemStyle: { color: '#3a5bb5' } },
    }],
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  };
}

function buildScatterOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || '散点图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'item',
      formatter: (params) => `${x_label || 'X'}: ${params.value[0]}<br/>${y_label || 'Y'}: ${params.value[1]}`,
    },
    xAxis: { type: 'value', name: x_label || '' },
    yAxis: { type: 'value', name: y_label || '' },
    series: [{
      type: 'scatter',
      data: data.map((d) => [d.x, d.y]),
      symbolSize: 8,
      itemStyle: { color: '#5470c6', opacity: 0.7 },
    }],
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  };
}

function buildBoxOption(chartData) {
  const { data, x_label, y_label, title } = chartData;

  return {
    title: { text: title || '箱线图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const d = data[params.dataIndex];
        if (!d) return '';
        return `<strong>${d.label}</strong><br/>
          最小值: ${d.min}<br/>
          Q1: ${d.q1}<br/>
          中位数: ${d.median}<br/>
          Q3: ${d.q3}<br/>
          最大值: ${d.max}<br/>
          异常值: ${d.outliers?.join(', ') || '无'}`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      name: x_label || '',
    },
    yAxis: {
      type: 'value',
      name: y_label || '值',
    },
    series: [
      {
        type: 'boxplot',
        // ECharts boxplot: [min, Q1, median, Q3, max]
        data: data.map((d) => [d.min, d.q1, d.median, d.q3, d.max]),
        itemStyle: {
          color: '#5470c6',
          borderColor: '#3a5bb5',
        },
      },
      // 异常值作为散点叠加
      {
        type: 'scatter',
        data: data.flatMap((d, idx) =>
          (d.outliers || []).map((o) => [idx, o]),
        ),
        symbolSize: 6,
        itemStyle: { color: '#ee6666' },
        tooltip: {
          formatter: (params) => `异常值: ${params.value[1]}`,
        },
      },
    ],
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  };
}

function buildBarOption(chartData) {
  const { data, x_label, y_label, title } = chartData;
  return {
    title: { text: title || '柱状图', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.label),
      name: x_label || '',
      axisLabel: { rotate: data.length > 8 ? 30 : 0, interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: y_label || '',
    },
    series: [{
      type: 'bar',
      data: data.map((d) => d.value),
      itemStyle: {
        color: '#91cc75',
        borderRadius: [4, 4, 0, 0],
      },
    }],
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
  };
}

function buildClusterScatterOption(chartData) {
  const { data, x_label, y_label, title } = chartData;

  // 按 cluster 分组
  const clusters = {};
  for (const point of data) {
    const c = point.cluster;
    if (!clusters[c]) clusters[c] = [];
    clusters[c].push([point.x, point.y]);
  }

  const clusterIds = Object.keys(clusters).sort((a, b) => Number(a) - Number(b));

  return {
    title: { text: title || 'K-Means 聚类结果', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'item',
      formatter: (params) => {
        const clusterLabel = params.seriesName;
        return `簇 ${clusterLabel}<br/>${x_label || 'X'}: ${params.value[0]}<br/>${y_label || 'Y'}: ${params.value[1]}`;
      },
    },
    legend: {
      data: clusterIds.map((c) => `簇 ${c}`),
      bottom: 0,
    },
    xAxis: { type: 'value', name: x_label || '' },
    yAxis: { type: 'value', name: y_label || '' },
    series: clusterIds.map((clusterId, idx) => ({
      name: `簇 ${clusterId}`,
      type: 'scatter',
      data: clusters[clusterId],
      symbolSize: 7,
      itemStyle: {
        color: CLUSTER_PALETTE[idx % CLUSTER_PALETTE.length],
        opacity: 0.75,
      },
    })),
    grid: { left: '3%', right: '4%', bottom: '12%', containLabel: true },
  };
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
    return (
      <div className="chart-placeholder">
        暂无图表数据
      </div>
    );
  }

  return (
    <div className="chart-container">
      <ReactECharts
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
        opts={{ locale: 'ZH' }}
      />
    </div>
  );
}

export default ChartRenderer;
