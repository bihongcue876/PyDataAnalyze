import React, { useState } from 'react';

/**
 * ExportPanel —— 数据导出
 *
 * Props:
 *   sessionId — 当前会话 ID
 *   onExport  — (format) => void
 *   isLoading — 全局加载状态
 *   setError  — 设置全局错误
 */

const FORMATS = [
  { value: 'csv', label: 'CSV 格式 (.csv)', icon: '📄', desc: '通用表格格式，兼容 Excel、Google Sheets' },
  { value: 'excel', label: 'Excel 格式 (.xlsx)', icon: '📊', desc: 'Microsoft Excel 原生格式，保留数据类型' },
];

function ExportPanel({ sessionId, onExport, isLoading, setError }) {
  const [format, setFormat] = useState('csv');
  const [exported, setExported] = useState(false);

  const handleExport = async () => {
    if (!sessionId || isLoading) return;

    setExported(false);
    try {
      await onExport(format);
      setExported(true);
      // 3 秒后自动清除"已完成"状态
      setTimeout(() => setExported(false), 3000);
    } catch {
      // 错误由父组件处理
    }
  };

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: '#34a853' }}>5</span>
        导出数据
      </div>
      <div className="card-body">
        <p className="small text-muted mb-3">
          导出当前会话中的所有数据（清洗后 + 聚类结果），不含 pandas 行号索引。
        </p>

        {/* 格式选择 */}
        <div className="export-options mb-3">
          {FORMATS.map((f) => (
            <div className="form-check" key={f.value}>
              <input
                className="form-check-input"
                type="radio"
                name="exportFormat"
                id={`format-${f.value}`}
                value={f.value}
                checked={format === f.value}
                onChange={(e) => setFormat(e.target.value)}
              />
              <label className="form-check-label" htmlFor={`format-${f.value}`}>
                <span className="me-1">{f.icon}</span>
                {f.label}
                <br />
                <small className="text-muted">{f.desc}</small>
              </label>
            </div>
          ))}
        </div>

        {/* 导出按钮 */}
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-success px-4"
            onClick={handleExport}
            disabled={!sessionId || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                导出中...
              </>
            ) : (
              '导出数据'
            )}
          </button>

          {exported && (
            <span className="text-success small">
              ✅ 下载完成
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ExportPanel;
