import React, { useState, useRef, useCallback } from 'react';

/**
 * FileUpload — 拖拽/浏览上传 CSV/Excel 文件
 *
 * Props:
 *   onUploadSuccess(fileInfo) — 上传成功后回调，传入 UploadResponse
 *   isLoading              — 全局加载状态
 *   setError               — 设置全局错误
 */

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUpload({ onUploadSuccess, isLoading, setError }) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // ---- 文件选择校验 ----

  const validateAndSelect = useCallback((file) => {
    setError(null);

    // 仅接受单文件
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('不支持的文件格式，请上传 CSV（.csv）或 Excel（.xlsx / .xls）文件');
      return;
    }

    const MAX = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX) {
      setError(`文件大小 (${formatFileSize(file.size)}) 超过 10MB 限制`);
      return;
    }

    if (file.size === 0) {
      setError('文件为空，请选择有效的数据文件');
      return;
    }

    setSelectedFile(file);
  }, [setError]);

  // ---- 事件处理 ----

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      validateAndSelect(files[0]); // 只取第一个文件
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!selectedFile || uploading || isLoading) return;

    setUploading(true);
    try {
      await onUploadSuccess(selectedFile);
      // 成功后保留文件信息展示，不清空
    } catch {
      // 错误由父组件处理
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ---- 渲染 ----

  const isBusy = uploading || isLoading;

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge">1</span>
        上传数据文件
      </div>
      <div className="card-body">
        {/* ---- 拖拽区域 ---- */}
        {!selectedFile ? (
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleBrowseClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleBrowseClick(); }}
          >
            <div className="drop-icon">📁</div>
            <p className="drop-text">拖拽文件到此处，或点击浏览</p>
            <p className="drop-hint">支持 CSV（.csv）、Excel（.xlsx / .xls）格式，最大 10MB</p>
          </div>
        ) : (
          /* ---- 文件已选择 ---- */
          <div>
            <div className="drop-zone" style={{ cursor: 'default', borderStyle: 'solid', borderColor: '#1a73e8', backgroundColor: '#e8f0fe' }}>
              <div className="file-selected" style={{ margin: 0, background: 'transparent' }}>
                <span className="file-icon">
                  {selectedFile.name.endsWith('.csv') ? '📄' : '📊'}
                </span>
                <div className="file-info">
                  <div className="file-name" title={selectedFile.name}>{selectedFile.name}</div>
                  <div className="file-size">{formatFileSize(selectedFile.size)}</div>
                </div>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={(e) => { e.stopPropagation(); handleRemoveFile(); }}
                  disabled={isBusy}
                  title="移除文件"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-center mt-3">
              <button
                className="btn btn-primary px-4"
                onClick={handleUpload}
                disabled={isBusy}
              >
                {isBusy ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    上传中...
                  </>
                ) : (
                  '上传文件'
                )}
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-label="选择数据文件"
        />
      </div>
    </div>
  );
}

export default FileUpload;
