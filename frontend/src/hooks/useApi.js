/**
 * useDataSession —— 会话状态管理与 API 调用封装
 *
 * 前端唯一的状态中枢。所有跨组件共享的数据均在此管理，
 * 通过 HomePage 提升状态后以 props 下发到各子组件。
 */

import { useState, useCallback } from 'react';
import * as api from '../api';

export function useDataSession() {
  // ---- 上传/清洗共享状态 ----
  const [sessionId, setSessionId] = useState(null);
  const [filename, setFilename] = useState(null);
  const [rows, setRows] = useState(null);
  const [cols, setCols] = useState(null);
  const [columns, setColumns] = useState([]);
  const [previewData, setPreviewData] = useState([]);
  const [cleanOperations, setCleanOperations] = useState(null);

  // ---- 可视化/分析结果 ----
  const [chartData, setChartData] = useState(null);
  const [clusterResult, setClusterResult] = useState(null);

  // ---- 全局 UI ----
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- 健康检查 ----
  const [backendOnline, setBackendOnline] = useState(null); // null=检测中, true=在线, false=离线

  // ============================================================
  // 上传
  // ============================================================
  const handleUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      // 客户端校验
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['csv', 'xlsx', 'xls'].includes(ext)) {
        throw new Error('不支持的文件格式，请上传 CSV（.csv）或 Excel（.xlsx / .xls）文件');
      }
      if (file.size > api.MAX_FILE_SIZE) {
        throw new Error('文件大小超过 10MB 限制，请选择更小的文件');
      }

      const data = await api.uploadFile(file);
      setSessionId(data.session_id);
      setFilename(data.filename);
      setRows(data.rows);
      setCols(data.cols);
      setColumns(data.columns);
      setPreviewData(data.preview);

      // 新上传 → 重置下游状态
      setCleanOperations(null);
      setChartData(null);
      setClusterResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // 清洗
  // ============================================================
  const handleClean = useCallback(async (cleanReq) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.cleanData(cleanReq);
      setCleanOperations(data.operations);
      setRows(data.rows);
      setCols(data.cols);
      setColumns(data.columns);
      setPreviewData(data.preview);

      // 清洗后数据变了，下游结果失效
      setChartData(null);
      setClusterResult(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // 图表
  // ============================================================
  const handleChart = useCallback(async (chartReq) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getChartData(chartReq);
      setChartData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // 聚类分析
  // ============================================================
  const handleCluster = useCallback(async (clusterReq) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.runClustering(clusterReq);
      setClusterResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // 导出
  // ============================================================
  const handleExport = useCallback(async (format = 'csv') => {
    if (!sessionId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { blob, filename } = await api.exportData({
        session_id: sessionId,
        format,
      });

      // 触发浏览器下载
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // ============================================================
  // 健康检查
  // ============================================================
  const handleHealthCheck = useCallback(async () => {
    try {
      await api.checkHealth();
      setBackendOnline(true);
    } catch {
      setBackendOnline(false);
    }
  }, []);

  // ============================================================
  // 重置
  // ============================================================
  const resetSession = useCallback(() => {
    setSessionId(null);
    setFilename(null);
    setRows(null);
    setCols(null);
    setColumns([]);
    setPreviewData([]);
    setCleanOperations(null);
    setChartData(null);
    setClusterResult(null);
    setError(null);
  }, []);

  // ============================================================
  // 导出
  // ============================================================
  return {
    // 状态
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

    // 操作
    handleUpload,
    handleClean,
    handleChart,
    handleCluster,
    handleExport,
    handleHealthCheck,
    resetSession,

    // 直接设置器（供子组件在某些场景直接更新）
    setError,
    setChartData,
    setClusterResult,
  };
}
