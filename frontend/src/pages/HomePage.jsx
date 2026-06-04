import React, { useEffect } from 'react';
import { useDataSession } from '../hooks/useApi';
import FileUpload from '../components/FileUpload';
import DataPreview from '../components/DataPreview';
import DataCleaning from '../components/DataCleaning';
import Visualization from '../components/Visualization';
import Clustering from '../components/Clustering';
import ExportPanel from '../components/ExportPanel';

/**
 * HomePage —— 应用主页面，状态编排中枢。
 *
 * 使用 useDataSession hook 管理所有共享状态，
 * 通过 props 下发给各功能组件。组件始终渲染，
 * 无 sessionId 时以半透明遮罩禁用。
 */

// ---- 辅助组件：禁用遮罩 ----

function DisabledOverlay({ show, message = '请先上传文件' }) {
  if (!show) return null;
  return (
    <div className="component-overlay" style={{ display: 'flex' }}>
      <span className="overlay-text">{message}</span>
    </div>
  );
}

// ---- 辅助组件：组件包装器 ----

function SectionWrapper({ disabled, disabledMessage, children }) {
  return (
    <div className={`component-wrapper ${disabled ? 'disabled' : ''}`}>
      <DisabledOverlay show={disabled} message={disabledMessage} />
      {children}
    </div>
  );
}

// ============================================================

function HomePage() {
  const {
    sessionId,
    filename,
    rows,
    cols,
    columns,
    previewData,
    cleanOperations,
    chartData,
    clusterResult,
    isLoading,
    error,
    backendOnline,
    handleUpload,
    handleClean,
    handleChart,
    handleCluster,
    handleExport,
    handleHealthCheck,
    resetSession,
    setError,
  } = useDataSession();

  // 启动时健康检查
  useEffect(() => {
    handleHealthCheck();
  }, [handleHealthCheck]);

  const hasSession = sessionId !== null;

  // ============================================================
  // 渲染
  // ============================================================

  return (
    <>
      {/* ========== 顶栏 ========== */}
      <header className="app-header">
        <div className="container">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h1>📊 PyDataAnalyze</h1>
              <span className="header-subtitle">交互式数据分析系统</span>
            </div>
            <div className="d-flex align-items-center gap-3">
              {/* 健康检查指示器 */}
              <span className="health-indicator" title={backendOnline ? '后端已连接' : backendOnline === false ? '后端未连接' : '检测中...'}>
                <span className={`health-dot ${backendOnline === true ? 'online' : backendOnline === false ? 'offline' : 'checking'}`}></span>
                {backendOnline === true ? '后端已连接' : backendOnline === false ? '后端未连接' : '检测中...'}
              </span>

              {/* 重置按钮 */}
              {hasSession && (
                <button
                  className="btn btn-outline-light btn-sm"
                  onClick={resetSession}
                  disabled={isLoading}
                  title="清除当前会话，重新开始"
                >
                  重新开始
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========== 主内容区 ========== */}
      <main className="main-content">
        <div className="container" style={{ maxWidth: '960px' }}>
          {/* ---- 全局错误提示 ---- */}
          {error && (
            <div className="global-error">
              <div className="alert alert-danger alert-dismissible fade show mb-0 shadow-sm" role="alert">
                <strong>⚠️</strong> {error}
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setError(null)}
                  aria-label="关闭"
                ></button>
              </div>
            </div>
          )}

          {/* ---- 后端离线警告 ---- */}
          {backendOnline === false && (
            <div className="alert alert-warning d-flex align-items-center gap-2" role="alert">
              <span>🔌</span>
              <span>后端服务未连接，请确认后端已启动（<code>uvicorn backend.main:app --port 8000</code>）</span>
            </div>
          )}

          {/* ======== 步骤 1: 上传 ======== */}
          <FileUpload
            onUploadSuccess={handleUpload}
            isLoading={isLoading}
            setError={setError}
          />

          {/* ======== 数据预览（有条件渲染） ======== */}
          <DataPreview
            filename={filename}
            rows={rows}
            cols={cols}
            columns={columns}
            previewData={previewData}
            cleanOperations={cleanOperations}
          />

          {/* ======== 步骤 2: 清洗 ======== */}
          <SectionWrapper disabled={!hasSession} disabledMessage="请先上传文件">
            <DataCleaning
              sessionId={sessionId}
              columns={columns}
              onCleanSuccess={handleClean}
              isLoading={isLoading}
              setError={setError}
            />
          </SectionWrapper>

          {/* ======== 步骤 3: 可视化 ======== */}
          <SectionWrapper disabled={!hasSession} disabledMessage="请先上传文件">
            <Visualization
              sessionId={sessionId}
              columns={columns}
              onChartGenerated={handleChart}
              chartData={chartData}
              isLoading={isLoading}
              setError={setError}
            />
          </SectionWrapper>

          {/* ======== 步骤 4: 聚类分析 ======== */}
          <SectionWrapper disabled={!hasSession} disabledMessage="请先上传文件">
            <Clustering
              sessionId={sessionId}
              columns={columns}
              onClusterComplete={handleCluster}
              clusterResult={clusterResult}
              isLoading={isLoading}
              setError={setError}
            />
          </SectionWrapper>

          {/* ======== 步骤 5: 导出 ======== */}
          <SectionWrapper disabled={!hasSession} disabledMessage="请先上传文件">
            <ExportPanel
              sessionId={sessionId}
              onExport={handleExport}
              isLoading={isLoading}
              setError={setError}
            />
          </SectionWrapper>
        </div>
      </main>
    </>
  );
}

export default HomePage;
