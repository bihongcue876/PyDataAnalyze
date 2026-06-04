import React, { useState, useMemo } from 'react';

/**
 * DataCleaning — 数据清洗配置表单
 *
 * Props:
 *   sessionId      — 当前会话 ID
 *   columns        — ColumnInfo[] 列信息
 *   onCleanSuccess — 清洗成功后回调 (cleanReq) => void
 *   isLoading      — 全局加载状态
 *   setError       — 设置全局错误
 */

/** 判断 dtype 是否为数值类型 */
function isNumeric(dtype) {
  return dtype.includes('int') || dtype.includes('float');
}

function DataCleaning({ sessionId, columns, onCleanSuccess, isLoading, setError }) {
  // ---- 局部状态 ----
  const [fillMissing, setFillMissing] = useState(true);
  const [fillStrategy, setFillStrategy] = useState('mean');
  const [removeOutliers, setRemoveOutliers] = useState(false);
  const [outlierColumns, setOutlierColumns] = useState([]);
  const [outlierMethod, setOutlierMethod] = useState('iqr');
  const [dropDuplicates, setDropDuplicates] = useState(true);

  // ---- 派生数据 ----
  const numericColumns = useMemo(
    () => columns.filter((c) => isNumeric(c.dtype)),
    [columns],
  );

  const hasNumericCols = numericColumns.length > 0;

  // 是否有任一项清洗操作被选中
  const hasAnyOperation = fillMissing || removeOutliers || dropDuplicates;

  // 如果勾选了异常值检测但没选具体列 → 允许执行（后端按空数组处理 = 全部数值列）
  const canExecute = hasAnyOperation && !isLoading;

  // ---- 事件处理 ----

  const handleOutlierColumnToggle = (colName) => {
    setOutlierColumns((prev) =>
      prev.includes(colName)
        ? prev.filter((c) => c !== colName)
        : [...prev, colName],
    );
  };

  const handleSelectAllOutlierCols = () => {
    if (outlierColumns.length === numericColumns.length) {
      setOutlierColumns([]);
    } else {
      setOutlierColumns(numericColumns.map((c) => c.name));
    }
  };

  const handleExecute = async () => {
    if (!canExecute || !sessionId) return;

    await onCleanSuccess({
      session_id: sessionId,
      fill_missing: fillMissing,
      fill_strategy: fillStrategy,
      remove_outliers: removeOutliers,
      outlier_columns: outlierColumns,
      outlier_method: outlierMethod,
      drop_duplicates: dropDuplicates,
    });
  };

  // ---- 渲染 ----

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: '#ea8c00' }}>2</span>
        数据清洗
      </div>
      <div className="card-body">
        {/* ======== 缺失值处理 ======== */}
        <div className="cleaning-section">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="fillMissing"
              checked={fillMissing}
              onChange={(e) => setFillMissing(e.target.checked)}
            />
            <label className="form-check-label fw-semibold" htmlFor="fillMissing">
              填充缺失值
            </label>
          </div>
          {fillMissing && (
            <div className="cleaning-options">
              <label className="form-label small text-muted">填充策略</label>
              <select
                className="form-select form-select-sm"
                value={fillStrategy}
                onChange={(e) => setFillStrategy(e.target.value)}
                style={{ maxWidth: '280px' }}
              >
                <option value="mean">均值填充 (mean)</option>
                <option value="median">中位数填充 (median)</option>
                <option value="mode">众数填充 (mode)</option>
                <option value="drop">删除含缺失值的行 (drop)</option>
              </select>
              {fillStrategy === 'drop' && (
                <small className="text-warning d-block mt-1">
                  ⚠️ 删除含缺失值的行可能会显著减少数据量
                </small>
              )}
            </div>
          )}
        </div>

        {/* ======== 异常值检测 ======== */}
        <div className="cleaning-section">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="removeOutliers"
              checked={removeOutliers}
              onChange={(e) => setRemoveOutliers(e.target.checked)}
              disabled={!hasNumericCols}
            />
            <label className="form-check-label fw-semibold" htmlFor="removeOutliers">
              移除异常值
            </label>
            {!hasNumericCols && (
              <small className="text-muted d-block mt-1">
                没有可用的数值列，无法进行异常值检测
              </small>
            )}
          </div>
          {removeOutliers && hasNumericCols && (
            <div className="cleaning-options">
              {/* 检测方法 */}
              <div className="mb-2">
                <label className="form-label small text-muted">检测方法</label>
                <select
                  className="form-select form-select-sm"
                  value={outlierMethod}
                  onChange={(e) => setOutlierMethod(e.target.value)}
                  style={{ maxWidth: '280px' }}
                >
                  <option value="iqr">IQR 方法（四分位距）</option>
                  <option value="zscore">Z-Score 方法（标准差）</option>
                </select>
              </div>

              {/* 目标列选择 */}
              <div>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <label className="form-label small text-muted mb-0">
                    检测列（空 = 所有数值列）
                  </label>
                  <button
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={handleSelectAllOutlierCols}
                    type="button"
                  >
                    {outlierColumns.length === numericColumns.length ? '取消全选' : '全选'}
                  </button>
                </div>
                <div className="outlier-columns-list">
                  {numericColumns.map((col) => (
                    <div className="form-check form-check-inline" key={col.name}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`outlier-${col.name}`}
                        checked={outlierColumns.includes(col.name)}
                        onChange={() => handleOutlierColumnToggle(col.name)}
                      />
                      <label className="form-check-label small" htmlFor={`outlier-${col.name}`}>
                        {col.name}
                        <span className="dtype-badge" style={{ fontSize: '0.6rem' }}>
                          {col.dtype}
                        </span>
                      </label>
                    </div>
                  ))}
                  {numericColumns.length === 0 && (
                    <span className="text-muted small">无可用列</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======== 重复值处理 ======== */}
        <div className="cleaning-section">
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              id="dropDuplicates"
              checked={dropDuplicates}
              onChange={(e) => setDropDuplicates(e.target.checked)}
            />
            <label className="form-check-label fw-semibold" htmlFor="dropDuplicates">
              删除重复行
            </label>
          </div>
        </div>

        {/* ======== 执行按钮 ======== */}
        <div className="d-flex align-items-center gap-2 mt-2">
          <button
            className="btn btn-warning px-4"
            onClick={handleExecute}
            disabled={!canExecute}
            title={!hasAnyOperation ? '请至少选择一项清洗操作' : ''}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                清洗中...
              </>
            ) : (
              '执行清洗'
            )}
          </button>
          {!hasAnyOperation && (
            <small className="text-muted">请至少选择一项清洗操作</small>
          )}
        </div>
      </div>
    </div>
  );
}

export default DataCleaning;
