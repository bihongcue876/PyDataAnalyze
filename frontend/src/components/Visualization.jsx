import React, { useState, useMemo } from 'react';
import ChartRenderer from './ChartRenderer';

/**
 * Visualization —— 图表配置与生成
 *
 * Props:
 *   sessionId        — 会话 ID
 *   columns          — ColumnInfo[] 列信息
 *   onChartGenerated — (chartReq) => void，触发 API 调用
 *   chartData        — ChartData | null，渲染用
 *   isLoading        — 全局加载状态
 *   setError         — 设置全局错误
 */

const CHART_TYPES = [
  { value: 'histogram', label: '直方图', icon: '📊' },
  { value: 'scatter', label: '散点图', icon: '🔵' },
  { value: 'box', label: '箱线图', icon: '📦' },
  { value: 'bar', label: '柱状图', icon: '📈' },
];

/** 判断 dtype 是否为数值类型 */
function isNumeric(dtype) {
  return dtype.includes('int') || dtype.includes('float');
}

function Visualization({ sessionId, columns, onChartGenerated, chartData, isLoading, setError }) {
  // ---- 局部状态 ----
  const [chartType, setChartType] = useState('histogram');
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [boxColumns, setBoxColumns] = useState([]);

  // ---- 派生数据 ----

  const numericColumns = useMemo(
    () => columns.filter((c) => isNumeric(c.dtype)),
    [columns],
  );

  // 柱状图：X 轴可以展示所有列，Y 轴仅数值列
  const allColumnNames = useMemo(() => columns.map((c) => c.name), [columns]);
  const numericColumnNames = useMemo(() => numericColumns.map((c) => c.name), [numericColumns]);

  // ---- 验证 ----

  const validation = useMemo(() => {
    switch (chartType) {
      case 'histogram':
        if (!xColumn) return { valid: false, hint: '请选择 X 轴数值列' };
        // 直方图需要数值列
        if (!isNumeric(columns.find((c) => c.name === xColumn)?.dtype || '')) {
          return { valid: false, hint: '直方图 X 轴需要选择数值列' };
        }
        return { valid: true, hint: '' };

      case 'scatter':
        if (!xColumn) return { valid: false, hint: '请选择 X 轴列' };
        if (!yColumn) return { valid: false, hint: '散点图需要选择 Y 轴列' };
        return { valid: true, hint: '' };

      case 'box':
        if (boxColumns.length === 0) return { valid: false, hint: '请至少选择一个数值列' };
        return { valid: true, hint: '' };

      case 'bar':
        if (!xColumn) return { valid: false, hint: '请选择 X 轴分类列' };
        return { valid: true, hint: '' };

      default:
        return { valid: false, hint: '' };
    }
  }, [chartType, xColumn, yColumn, boxColumns, columns]);

  // ---- 事件处理 ----

  const handleChartTypeChange = (type) => {
    if (type === chartType) return;
    setChartType(type);
    // 切换类型时重置列选择，避免跨类型的无效状态
    setXColumn('');
    setYColumn('');
    setBoxColumns([]);
  };

  const handleBoxColumnToggle = (colName) => {
    setBoxColumns((prev) =>
      prev.includes(colName)
        ? prev.filter((c) => c !== colName)
        : [...prev, colName],
    );
  };

  const handleSelectAllBoxCols = () => {
    if (boxColumns.length === numericColumns.length) {
      setBoxColumns([]);
    } else {
      setBoxColumns(numericColumns.map((c) => c.name));
    }
  };

  const handleGenerate = async () => {
    if (!validation.valid || !sessionId) return;

    const req = {
      session_id: sessionId,
      chart_type: chartType,
    };

    if (chartType === 'box') {
      req.columns = boxColumns;
    } else {
      req.x_column = xColumn;
      if (chartType === 'scatter' || yColumn) {
        req.y_column = yColumn || undefined;
      }
    }

    await onChartGenerated(req);
  };

  // ---- 渲染 ----

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: '#1a73e8' }}>3</span>
        数据可视化
      </div>
      <div className="card-body">
        {/* ======== 图表类型选择 ======== */}
        <label className="form-label fw-semibold small">图表类型</label>
        <div className="chart-type-selector">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              className={`chart-type-btn ${chartType === ct.value ? 'active' : ''}`}
              onClick={() => handleChartTypeChange(ct.value)}
              type="button"
            >
              <span className="me-1">{ct.icon}</span>
              {ct.label}
            </button>
          ))}
        </div>

        {/* ======== 列选择器（动态） ======== */}
        <div className="row g-3 mb-3">
          {/* --- histogram: 单列 X --- */}
          {chartType === 'histogram' && (
            <div className="col-md-6">
              <label className="form-label small text-muted">X 轴（数值列）</label>
              <select
                className="form-select form-select-sm"
                value={xColumn}
                onChange={(e) => setXColumn(e.target.value)}
              >
                <option value="">-- 选择列 --</option>
                {numericColumnNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <small className="text-muted">直方图展示数值列的分布</small>
            </div>
          )}

          {/* --- scatter: X + Y --- */}
          {chartType === 'scatter' && (
            <>
              <div className="col-md-6">
                <label className="form-label small text-muted">X 轴（数值列）</label>
                <select
                  className="form-select form-select-sm"
                  value={xColumn}
                  onChange={(e) => setXColumn(e.target.value)}
                >
                  <option value="">-- 选择列 --</option>
                  {numericColumnNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small text-muted">Y 轴（数值列）</label>
                <select
                  className="form-select form-select-sm"
                  value={yColumn}
                  onChange={(e) => setYColumn(e.target.value)}
                >
                  <option value="">-- 选择列 --</option>
                  {numericColumnNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* --- box: 多列选择 --- */}
          {chartType === 'box' && (
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small text-muted mb-0">
                  选择列（至少一列，多列并排展示）
                </label>
                <button
                  className="btn btn-link btn-sm text-decoration-none p-0"
                  onClick={handleSelectAllBoxCols}
                  type="button"
                >
                  {boxColumns.length === numericColumns.length ? '取消全选' : '全选'}
                </button>
              </div>
              <div className="outlier-columns-list">
                {numericColumns.length > 0 ? (
                  numericColumns.map((col) => (
                    <div className="form-check form-check-inline" key={col.name}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`boxcol-${col.name}`}
                        checked={boxColumns.includes(col.name)}
                        onChange={() => handleBoxColumnToggle(col.name)}
                      />
                      <label className="form-check-label small" htmlFor={`boxcol-${col.name}`}>
                        {col.name}
                      </label>
                    </div>
                  ))
                ) : (
                  <span className="text-muted small">无可用数值列</span>
                )}
              </div>
              <small className="text-muted d-block mt-1">
                箱线图展示列的数据分布（最小值、四分位数、最大值、异常值）
              </small>
            </div>
          )}

          {/* --- bar: X 必选 + Y 可选 --- */}
          {chartType === 'bar' && (
            <>
              <div className="col-md-6">
                <label className="form-label small text-muted">X 轴（分类列）</label>
                <select
                  className="form-select form-select-sm"
                  value={xColumn}
                  onChange={(e) => setXColumn(e.target.value)}
                >
                  <option value="">-- 选择列 --</option>
                  {allColumnNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <small className="text-muted">统计各类别频次</small>
              </div>
              <div className="col-md-6">
                <label className="form-label small text-muted">Y 轴（数值列，可选）</label>
                <select
                  className="form-select form-select-sm"
                  value={yColumn}
                  onChange={(e) => setYColumn(e.target.value)}
                >
                  <option value="">-- 不选择（统计频次） --</option>
                  {numericColumnNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                <small className="text-muted">选择 Y 轴后显示各类别均值</small>
              </div>
            </>
          )}
        </div>

        {/* ======== 生成按钮 ======== */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <button
            className="btn btn-primary px-4"
            onClick={handleGenerate}
            disabled={!validation.valid || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                生成中...
              </>
            ) : (
              '生成图表'
            )}
          </button>
          {!validation.valid && validation.hint && (
            <small className="text-muted">{validation.hint}</small>
          )}
        </div>

        {/* ======== 图表渲染区 ======== */}
        <ChartRenderer chartData={chartData} />
      </div>
    </div>
  );
}

export default Visualization;
