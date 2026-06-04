import React, { useState, useMemo, useEffect } from 'react';
import ChartRenderer from './ChartRenderer';

/**
 * Clustering —— K-Means 聚类分析
 *
 * Props:
 *   sessionId         — 会话 ID
 *   columns           — ColumnInfo[] 列信息
 *   onClusterComplete — (clusterReq) => void
 *   clusterResult     — AnalyzeResponse | null
 *   isLoading         — 全局加载状态
 *   setError          — 设置全局错误
 */

/** 判断 dtype 是否为数值类型 */
function isNumeric(dtype) {
  return dtype.includes('int') || dtype.includes('float');
}

function Clustering({ sessionId, columns, onClusterComplete, clusterResult, isLoading, setError }) {
  // ---- 局部状态 ----
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [nClusters, setNClusters] = useState(3);
  const [plotX, setPlotX] = useState('');
  const [plotY, setPlotY] = useState('');

  // ---- 派生数据 ----
  const numericColumns = useMemo(
    () => columns.filter((c) => isNumeric(c.dtype)),
    [columns],
  );

  const numericColumnNames = useMemo(
    () => numericColumns.map((c) => c.name),
    [numericColumns],
  );

  // ---- 默认值：plotX = selected[0], plotY = selected[1] ----
  useEffect(() => {
    if (selectedColumns.length >= 2) {
      if (!plotX || !selectedColumns.includes(plotX)) {
        setPlotX(selectedColumns[0]);
      }
      if (!plotY || !selectedColumns.includes(plotY)) {
        setPlotY(selectedColumns[1]);
      }
    }
  }, [selectedColumns]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 验证 ----

  const canRun = selectedColumns.length >= 2 && !isLoading;

  // ---- 事件处理 ----

  const handleColumnToggle = (colName) => {
    setSelectedColumns((prev) =>
      prev.includes(colName)
        ? prev.filter((c) => c !== colName)
        : [...prev, colName],
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
      columns: selectedColumns,
      n_clusters: nClusters,
      plot_x: plotX,
      plot_y: plotY,
    });
  };

  // ---- 渲染 ----

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: '#9334e6' }}>4</span>
        K-Means 聚类分析
      </div>
      <div className="card-body">
        {/* ======== 特征列选择 ======== */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label fw-semibold small mb-0">
              选择特征列（至少 2 个数值列）
            </label>
            <button
              className="btn btn-link btn-sm text-decoration-none p-0"
              onClick={handleSelectAllCols}
              type="button"
            >
              {selectedColumns.length === numericColumns.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="outlier-columns-list">
            {numericColumns.length > 0 ? (
              numericColumns.map((col) => (
                <div className="form-check form-check-inline" key={col.name}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`cluster-${col.name}`}
                    checked={selectedColumns.includes(col.name)}
                    onChange={() => handleColumnToggle(col.name)}
                  />
                  <label className="form-check-label small" htmlFor={`cluster-${col.name}`}>
                    {col.name}
                    <span className="dtype-badge" style={{ fontSize: '0.6rem' }}>
                      {col.dtype}
                    </span>
                  </label>
                </div>
              ))
            ) : (
              <span className="text-muted small">无可用数值列</span>
            )}
          </div>
          {selectedColumns.length < 2 && (
            <small className="text-warning d-block mt-1">
              ⚠️ 请至少选择 2 个数值列（当前已选 {selectedColumns.length} 个）
            </small>
          )}
        </div>

        {/* ======== K 值选择 ======== */}
        <div className="row g-3 mb-3">
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
                style={{ height: 'auto' }}
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
                style={{ width: '60px' }}
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
        </div>

        {/* ======== 散点图轴选择 ======== */}
        {selectedColumns.length >= 2 && (
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label small text-muted">聚类散点图 X 轴</label>
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
              <label className="form-label small text-muted">聚类散点图 Y 轴</label>
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
          style={{ backgroundColor: '#9334e6', color: '#fff' }}
          onClick={handleRun}
          disabled={!canRun}
        >
          {isLoading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2"></span>
              聚类计算中...
            </>
          ) : (
            '运行聚类'
          )}
        </button>

        {/* ======== 聚类结果 ======== */}
        {clusterResult && (
          <div className="mt-3">
            <hr />

            {/* 指标卡片 */}
            <div className="cluster-metrics">
              <div className="cluster-metric-card">
                <div className="metric-value">{clusterResult.n_clusters}</div>
                <div className="metric-label">聚类数 K</div>
              </div>
              <div className="cluster-metric-card">
                <div className="metric-value">
                  {clusterResult.inertia != null ? clusterResult.inertia.toFixed(2) : '-'}
                </div>
                <div className="metric-label">惯性值 (SSE)</div>
              </div>
              <div className="cluster-metric-card">
                <div className="metric-value">
                  {Object.keys(clusterResult.summary || {}).length}
                </div>
                <div className="metric-label">有效簇数</div>
              </div>
            </div>

            {/* 聚类散点图 */}
            {clusterResult.chart_data && (
              <ChartRenderer chartData={clusterResult.chart_data} height={400} />
            )}

            {/* 簇中心点坐标 */}
            {clusterResult.centers && clusterResult.centers.length > 0 && (
              <div className="mt-3">
                <h6 className="small fw-semibold text-muted mb-2">簇中心点坐标</h6>
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
                            <td key={vi}>{typeof val === 'number' ? val.toFixed(3) : val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 簇摘要表 */}
            {clusterResult.summary && (
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
                              {info.mean[col] != null
                                ? Number(info.mean[col]).toFixed(3)
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Clustering;
