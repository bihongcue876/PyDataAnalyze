/**
 * useDataSession —— 会话状态管理与 API 调用封装
 *
 * 前端唯一的状态中枢。所有跨组件共享的数据均在此管理，
 * 通过 HomePage 提升状态后以 props 下发到各子组件。
 */

import { useState, useCallback } from "react";
import * as api from "../api";

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

  // ---- 历史记录 ----
  const [historyData, setHistoryData] = useState(null);

  // ---- 全局 UI ----
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ---- 健康检查 ----
  const [backendOnline, setBackendOnline] = useState(null);

  // ============================================================
  // 上传
  // ============================================================
  const handleUpload = useCallback(async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.uploadFile(file);
      setSessionId(data.session_id);
      setFilename(data.filename);
      setRows(data.rows);
      setCols(data.cols);
      setColumns(data.columns);
      setPreviewData(data.preview);

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
  // 从历史会话恢复
  // ============================================================
  const handleLoadSession = useCallback(async (sessionId) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.loadSession(sessionId);
      setSessionId(data.session_id);
      setFilename(data.filename || `session_${data.session_id.slice(0, 8)}`);
      setRows(data.rows);
      setCols(data.cols);
      setColumns(data.columns);
      setPreviewData(data.preview);

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
  // 分析（聚类/降维）
  // ============================================================
  const handleCluster = useCallback(async (analysisReq) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.runAnalysis(analysisReq);
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
  const handleExport = useCallback(
    async (format = "csv") => {
      if (!sessionId) return;

      setIsLoading(true);
      setError(null);

      try {
        const { blob, filename } = await api.exportData({
          session_id: sessionId,
          format,
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
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
    },
    [sessionId],
  );

  // ============================================================
  // 历史记录
  // ============================================================
  const handleHistory = useCallback(async (params = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getHistory(params);
      setHistoryData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    setHistoryData(null);
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
    historyData,
    isLoading,
    error,
    backendOnline,

    // 操作
    handleUpload,
    handleLoadSession,
    handleClean,
    handleChart,
    handleCluster,
    handleExport,
    handleHistory,
    handleHealthCheck,
    resetSession,

    // 直接设置器
    setError,
    setChartData,
    setClusterResult,
    setHistoryData,
  };
}
