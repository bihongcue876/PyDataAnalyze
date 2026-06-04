import React from 'react';

/**
 * DataPreview — 显示上传/清洗后的数据预览表格
 *
 * Props:
 *   filename        — 原始文件名
 *   rows            — 总行数
 *   cols            — 总列数
 *   columns         — ColumnInfo[] { name, dtype }
 *   previewData     — 前 20 行数据 (Record<string, unknown>[])
 *   cleanOperations — 清洗操作列表（null = 未清洗）
 */

/** dtype 中文友好名映射 */
const DTYPE_LABELS = {
  'int64': '整数',
  'int32': '整数',
  'float64': '浮点数',
  'float32': '浮点数',
  'object': '文本',
  'bool': '布尔',
  'datetime64[ns]': '日期时间',
  'category': '分类',
};

function dtypeLabel(dtype) {
  return DTYPE_LABELS[dtype] || dtype;
}

/**
 * 安全渲染单元格值。null / undefined / NaN / 空字符串统一显示为 "-"。
 */
function renderCell(value) {
  if (value === null || value === undefined) {
    return <span className="cell-null">-</span>;
  }
  if (typeof value === 'number' && isNaN(value)) {
    return <span className="cell-null">-</span>;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return <span className="cell-null">-</span>;
  }
  return String(value);
}

function DataPreview({ filename, rows, cols, columns, previewData, cleanOperations }) {
  // 无数据时不渲染
  if (!previewData || previewData.length === 0) {
    return null;
  }

  const colNames = columns.map((c) => c.name);

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: '#34a853' }}>✓</span>
        数据预览
      </div>
      <div className="card-body">
        {/* ---- 摘要条 ---- */}
        <div className="data-summary mb-3">
          <span className="summary-stat">
            📄 <strong>{filename || '-'}</strong>
          </span>
          <span className="summary-stat">
            行数: <strong>{rows ?? '-'}</strong>
          </span>
          <span className="summary-stat">
            列数: <strong>{cols ?? '-'}</strong>
          </span>
          <span className="summary-stat text-muted">
            显示前 {previewData.length} 行
          </span>
        </div>

        {/* ---- 清洗操作提示 ---- */}
        {cleanOperations && cleanOperations.length > 0 && (
          <div className="alert alert-success py-2 mb-3 d-flex align-items-center gap-2" role="alert">
            <span>✅</span>
            <span>已执行操作: <strong>{cleanOperations.join('、')}</strong></span>
          </div>
        )}

        {/* ---- 数据表格 ---- */}
        <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
          <table className="table table-striped table-hover preview-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                {colNames.map((name) => {
                  const colInfo = columns.find((c) => c.name === name);
                  return (
                    <th key={name}>
                      {name}
                      {colInfo && (
                        <span className="dtype-badge" title={`pandas dtype: ${colInfo.dtype}`}>
                          {dtypeLabel(colInfo.dtype)}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {previewData.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-muted">{idx + 1}</td>
                  {colNames.map((col) => (
                    <td key={col} title={row[col] != null ? String(row[col]) : undefined}>
                      {renderCell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataPreview;
