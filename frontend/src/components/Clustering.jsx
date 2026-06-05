import React, { useState, useMemo, useEffect } from "react";
import ChartRenderer from "./ChartRenderer";

/**
 * Clustering —— 聚类/降维分析（支持 4 种方法）
 *
 * Props:
 *   sessionId         — 会话 ID
 *   columns           — ColumnInfo[]
 *   onClusterComplete — (analysisReq) => void
 *   clusterResult     — AnalyzeResponse | null
 *   isLoading         — 全局加载状态
 *   setError          — 设置全局错误
 */

const METHODS = [
  { value: "kmeans", label: "K-Means", desc: "基于距离的划分聚类" },
  { value: "dbscan", label: "DBSCAN", desc: "基于密度的聚类，自动检测簇数" },
  { value: "agglomerative", label: "层次聚类", desc: "自底向上的凝聚层次聚类" },
  { value: "pca", label: "PCA", desc: "主成分分析降维" },
];

const METRICS_LABELS = {
  silhouette_score: "轮廓系数",
  calinski_harabasz_score: "CH 指数",
  davies_bouldin_score: "Davies-Bouldin",
  explained_variance_ratio: "解释方差比",
  noise_points: "噪声点数",
  n_clusters: "检测到的簇数",
};

function isNumeric(dtype) {
  return dtype.includes("int") || dtype.includes("float");
}

function Clustering({ sessionId, columns, onClusterComplete, clusterResult, isLoading, setError }) {
  // ---- 方法选择 ----
  const [method, setMethod] = useState("kmeans");

  // ---- 特征列 ----
  const [selectedColumns, setSelectedColumns] = useState([]);

  // ---- 各方法参数 ----
  const [nClusters, setNClusters] = useState(3);
  const [eps, setEps] = useState(0.5);
  const [minSamples, setMinSamples] = useState(5);
  const [nComponents, setNComponents] = useState(2);

  // ---- 散点图轴 ----
  const [plotX, setPlotX] = useState("");
  const [plotY, setPlotY] = useState("");

  // ---- 派生数据 ----
  const numericColumns = useMemo(() => columns.filter((c) => isNumeric(c.dtype)), [columns]);
  const numericColumnNames = useMemo(() => numericColumns.map((c) => c.name), [numericColumns]);

  // 默认轴值
  useEffect(() => {
    if (selectedColumns.length >= 2) {
      if (!plotX || !selectedColumns.includes(plotX)) setPlotX(selectedColumns[0]);
      if (!plotY || !selectedColumns.includes(plotY)) setPlotY(selectedColumns[1]);
    }
  }, [selectedColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 验证 ----
  const canRun = selectedColumns.length >= 2 && !isLoading;

  // ---- 构建请求参数 ----
  const buildParams = () => {
    const params = {};
    if (method === "kmeans" || method === "agglomerative") params.n_clusters = nClusters;
    if (method === "dbscan") {
      params.eps = eps;
      params.min_samples = minSamples;
    }
    if (method === "pca") params.n_components = nComponents;
    return params;
  };

  // ---- 事件 ----
  const handleColumnToggle = (colName) => {
    setSelectedColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName],
    );
  };

  const handleSelectAllCols = () => {
    if (selectedColumns.length === numericColumns.length) {
      setSelectedColumns([]);
    } else {
      setSelectedColumns(numericColumns.map((c) => c.name));
    }
  };

  const handleRun = async () => {
    if (!canRun || !sessionId) return;

    await onClusterComplete({
      session_id: sessionId,
      method,
      columns: selectedColumns,
      params: buildParams(),
      plot_x: plotX,
      plot_y: plotY,
    });
  };

  // ---- 切换方法时重置参数 ----
  const handleMethodChange = (newMethod) => {
    setMethod(newMethod);
  };

  // ---- 渲染 metrics ----
  const renderMetrics = () => {
    if (!clusterResult?.metrics) return null;
    const { metrics } = clusterResult;

    const entries = [];
    for (const [key, label] of Object.entries(METRICS_LABELS)) {
      const val = metrics[key];
      if (val == null) continue;
      if (Array.isArray(val)) {
        entries.push(
          <div className="cluster-metric-card" key={key}>
            <div className="metric-value" style={{ fontSize: "1rem" }}>
              {val.map((v) => (typeof v === "number" ? (v * 100).toFixed(1) + "%" : v)).join(", ")}
            </div>
            <div className="metric-label">{label}</div>
          </div>,
        );
      } else {
        entries.push(
          <div className="cluster-metric-card" key={key}>
            <div className="metric-value">
              {typeof val === "number" ? val.toFixed(4) : val}
            </div>
            <div className="metric-label">{label}</div>
          </div>,
        );
      }
    }

    // inertia 只对 kmeans
    if (clusterResult.inertia != null) {
      entries.push(
        <div className="cluster-metric-card" key="inertia">
          <div className="metric-value">{clusterResult.inertia.toFixed(2)}</div>
          <div className="metric-label">惯性值 (SSE)</div>
        </div>,
      );
    }

    return entries.length > 0 ? (
      <div className="cluster-metrics">{entries}</div>
    ) : null;
  };

  // ---- 渲染 centers ----
  const renderCenters = () => {
    if (!clusterResult.centers?.length) return null;

    return (
      <div className="mt-3">
        <h6 className="small fw-semibold text-muted mb-2">
          {method === "agglomerative" ? "各簇均值中心（近似）" : "簇中心点坐标"}
        </h6>
        <div className="table-responsive">
          <table className="table table-sm table-bordered small mb-0">
            <thead>
              <tr>
                <th>簇</th>
                {selectedColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clusterResult.centers.map((center, idx) => (
                <tr key={idx}>
                  <td><strong>簇 {idx}</strong></td>
                  {center.map((val, vi) => (
                    <td key={vi}>{typeof val === "number" ? val.toFixed(3) : val}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---- 渲染 summary ----
  const renderSummary = () => {
    if (!clusterResult.summary) return null;

    return (
      <div className="mt-3">
        <h6 className="small fw-semibold text-muted mb-2">各簇统计摘要</h6>
        <div className="table-responsive">
          <table className="table table-sm table-striped cluster-summary-table mb-0">
            <thead>
              <tr>
                <th>簇</th>
                <th>样本数</th>
                {selectedColumns.map((col) => (
                  <th key={col}>{col} 均值</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(clusterResult.summary).map(([clusterId, info]) => (
                <tr key={clusterId}>
                  <td><strong>簇 {clusterId}</strong></td>
                  <td>{info.count}</td>
                  {selectedColumns.map((col) => (
                    <td key={col}>
                      {info.mean[col] != null ? Number(info.mean[col]).toFixed(3) : "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---- PCA 加载成分表 ----
  const renderPCAColumns = () => {
    if (method !== "pca" || !clusterResult?.columns) return null;
    const pcCols = clusterResult.columns.filter((c) => c.name.startsWith("PC"));
    if (pcCols.length === 0) return null;

    return (
      <div className="mt-3">
        <h6 className="small fw-semibold text-muted mb-2">降维成分</h6>
        <div className="table-responsive">
          <table className="table table-sm table-striped small mb-0">
            <thead>
              <tr>
                <th>成分</th>
                <th>数据类型</th>
              </tr>
            </thead>
            <tbody>
              {pcCols.map((col) => (
                <tr key={col.name}>
                  <td>{col.name}</td>
                  <td>{col.dtype}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ---- 渲染 ----
  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: "#9334e6" }}>4</span>
        数据分析
      </div>
      <div className="card-body">
        {/* ======== 方法选择 ======== */}
        <div className="mb-3">
          <label className="form-label fw-semibold small">分析方法</label>
          <div className="chart-type-selector">
            {METHODS.map((m) => (
              <button
                key={m.value}
                className={`chart-type-btn ${method === m.value ? "active" : ""}`}
                onClick={() => handleMethodChange(m.value)}
                type="button"
                title={m.desc}
              >
                {m.label}
                <br />
                <small style={{ fontWeight: 400, fontSize: "0.7rem" }}>{m.desc}</small>
              </button>
            ))}
          </div>
        </div>

        {/* ======== 特征列选择 ======== */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label fw-semibold small mb-0">
              选择特征列{" "}
              <small className="text-muted">（至少 2 个数值列）</small>
            </label>
            <button
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={handleSelectAllCols}
              type="button"
            >
              {selectedColumns.length === numericColumns.length ? "取消全选" : "全选"}
            </button>
          </div>
          <div className="outlier-columns-list">
            {numericColumns.length > 0 ? (
              numericColumns.map((col) => (
                <div className="form-check form-check-inline" key={col.name}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`cluster-col-${col.name}`}
                    checked={selectedColumns.includes(col.name)}
                    onChange={() => handleColumnToggle(col.name)}
                  />
                  <label className="form-check-label small" htmlFor={`cluster-col-${col.name}`}>
                    {col.name}
                    <span className="dtype-badge" style={{ fontSize: "0.6rem" }}>
                      {col.dtype}
                    </span>
                  </label>
                </div>
              ))
            ) : (
              <span className="text-muted small">无可用数值列</span>
            )}
          </div>
        </div>

        {/* ======== 方法参数 ======== */}
        <div className="row g-3 mb-3">
          {/* K-Means / Agglomerative: K 值 */}
          {(method === "kmeans" || method === "agglomerative") && (
            <div className="col-md-6">
              <label className="form-label small text-muted">
                聚类数 K: <strong>{nClusters}</strong>
              </label>
              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setNClusters((k) => Math.max(2, k - 1))}
                  disabled={nClusters <= 2}
                  type="button"
                >
                  −
                </button>
                <input
                  type="range"
                  className="form-range flex-grow-1"
                  min="2"
                  max="10"
                  step="1"
                  value={nClusters}
                  onChange={(e) => setNClusters(Number(e.target.value))}
                  style={{ height: "auto" }}
                />
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setNClusters((k) => Math.min(10, k + 1))}
                  disabled={nClusters >= 10}
                  type="button"
                >
                  +
                </button>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "60px" }}
                  min="2"
                  max="10"
                  value={nClusters}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (v >= 2 && v <= 10) setNClusters(v);
                  }}
                />
              </div>
            </div>
          )}

          {/* DBSCAN: eps + min_samples */}
          {method === "dbscan" && (
            <>
              <div className="col-md-6">
                <label className="form-label small text-muted">
                  邻域半径 eps: <strong>{eps}</strong>
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="0.1"
                  max="2.0"
                  step="0.1"
                  value={eps}
                  onChange={(e) => setEps(Number(e.target.value))}
                />
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "80px" }}
                  min="0.1"
                  max="10"
                  step="0.1"
                  value={eps}
                  onChange={(e) => setEps(Number(e.target.value))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small text-muted">
                  最小样本数 min_samples: <strong>{minSamples}</strong>
                </label>
                <input
                  type="range"
                  className="form-range"
                  min="2"
                  max="20"
                  step="1"
                  value={minSamples}
                  onChange={(e) => setMinSamples(Number(e.target.value))}
                />
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "60px" }}
                  min="2"
                  max="50"
                  value={minSamples}
                  onChange={(e) => setMinSamples(Number(e.target.value))}
                />
              </div>
            </>
          )}

          {/* PCA: n_components */}
          {method === "pca" && (
            <div className="col-md-6">
              <label className="form-label small text-muted">
                降维维度: <strong>{nComponents}</strong>
              </label>
              <div className="d-flex align-items-center gap-2">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setNComponents((v) => Math.max(2, v - 1))}
                  disabled={nComponents <= 2}
                  type="button"
                >
                  −
                </button>
                <input
                  type="range"
                  className="form-range flex-grow-1"
                  min="2"
                  max={Math.min(10, Math.max(2, selectedColumns.length))}
                  step="1"
                  value={nComponents}
                  onChange={(e) => setNComponents(Number(e.target.value))}
                  style={{ height: "auto" }}
                />
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setNComponents((v) =>
                    Math.min(Math.min(10, Math.max(2, selectedColumns.length)), v + 1),
                  )}
                  disabled={nComponents >= Math.min(10, Math.max(2, selectedColumns.length))}
                  type="button"
                >
                  +
                </button>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  style={{ width: "60px" }}
                  min="2"
                  max="10"
                  value={nComponents}
                  onChange={(e) => setNComponents(Number(e.target.value))}
                />
              </div>
            </div>
          )}
        </div>

        {/* ======== 散点图轴 ======== */}
        {selectedColumns.length >= 2 && method !== "pca" && (
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label small text-muted">散点图 X 轴</label>
              <select
                className="form-select form-select-sm"
                value={plotX}
                onChange={(e) => setPlotX(e.target.value)}
              >
                {selectedColumns
                  .filter((c) => c !== plotY)
                  .map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small text-muted">散点图 Y 轴</label>
              <select
                className="form-select form-select-sm"
                value={plotY}
                onChange={(e) => setPlotY(e.target.value)}
              >
                {selectedColumns
                  .filter((c) => c !== plotX)
                  .map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
              </select>
            </div>
          </div>
        )}

        {/* ======== 运行按钮 ======== */}
        <button
          className="btn px-4 mb-3"
          style={{ backgroundColor: "#9334e6", color: "#fff" }}
          onClick={handleRun}
          disabled={!canRun}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              计算中...
            </>
          ) : (
            `运行${METHODS.find((m) => m.value === method)?.label || ""}`
          )}
        </button>

        {/* ======== 结果 ======== */}
        {clusterResult && (
          <div className="mt-3">
            <hr />

            {/* 评估指标 */}
            {renderMetrics()}

            {/* 图表 */}
            {clusterResult.chart_data && (
              <ChartRenderer chartData={clusterResult.chart_data} height={400} />
            )}

            {/* PCA 成分表 */}
            {renderPCAColumns()}

            {/* 簇中心 */}
            {renderCenters()}

            {/* 簇摘要 */}
            {renderSummary()}
          </div>
        )}
      </div>
    </div>
  );
}

export default Clustering;
