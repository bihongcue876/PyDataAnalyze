/**
 * PyDataAnalyze API 客户端
 *
 * 严格遵循 share/protocol.md v1.1 契约 —— 前后端交互的唯一事实来源。
 * 9 个端点，基于原生 fetch，30 秒超时，自动错误解析。
 *
 * @see share/protocol.md
 * @see share/protocol.ts (TypeScript 类型参考)
 */

// ============================================================
// 基础配置
// ============================================================

/** Vite proxy 将 /api 转发到 localhost:8000 */
const API_BASE = "/api";

/** 请求超时（毫秒） */
const TIMEOUT_MS = 30_000;

/** 上传文件大小上限（字节），与 protocol.md §3.1 一致 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ============================================================
// 端点路径常量（与 share/protocol.ts API 常量映射）
// ============================================================

export const API = {
  UPLOAD: "/api/upload",
  CLEAN: "/api/clean",
  CHART: "/api/chart",
  ANALYZE: "/api/analyze",
  EXPORT: "/api/export",
  HEALTH: "/api/health",
  HISTORY: "/api/history",
  SESSION_LOAD: "/api/session/",
};

// ============================================================
// fetch 封装
// ============================================================

/**
 * 带超时与统一错误处理的 fetch 封装。
 *
 * @param {string} url - API 路径（以 / 开头）
 * @param {RequestInit} [options={}] - fetch 选项
 * @returns {Promise<Response>}
 */
async function apiFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorMessage;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.detail;
      } catch {
        errorMessage = `请求失败 (HTTP ${response.status})`;
      }

      switch (response.status) {
        case 400:
          throw new Error(errorMessage || "请求参数不合法");
        case 404:
          throw new Error(errorMessage || "会话不存在或已过期");
        case 413:
          throw new Error("文件大小超过 10MB 限制");
        case 500:
          throw new Error(errorMessage || "服务器内部错误");
        default:
          throw new Error(errorMessage || `请求失败 (HTTP ${response.status})`);
      }
    }

    return response;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("请求超时，请检查后端是否运行");
    }
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("无法连接后端服务，请确认后端已启动");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 端点函数
// ============================================================

/**
 * POST /api/upload —— 上传文件
 *
 * @param {File} file - 用户选择的文件
 * @returns {Promise<import('../../../share/protocol.ts').UploadResponse>}
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await apiFetch("/upload", {
    method: "POST",
    body: formData,
  });

  return res.json();
}

/**
 * POST /api/clean —— 执行数据清洗
 *
 * @param {import('../../../share/protocol.ts').CleanRequest} body
 * @returns {Promise<import('../../../share/protocol.ts').CleanResponse>}
 */
export async function cleanData(body) {
  const res = await apiFetch("/clean", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * POST /api/chart —— 获取图表数据
 *
 * @param {{
 *   session_id: string,
 *   chart_type: 'histogram'|'scatter'|'box'|'bar'|'pie'|'line'|'heatmap'|'scatter_matrix',
 *   x_column?: string,
 *   y_column?: string,
 *   columns?: string[],
 *   color_column?: string
 * }} body
 * @returns {Promise<import('../../../share/protocol.ts').ChartData>}
 */
export async function getChartData(body) {
  const res = await apiFetch("/chart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * POST /api/analyze —— 运行分析（聚类/降维）
 *
 * @param {import('../../../share/protocol.ts').AnalyzeRequest} body
 * @returns {Promise<import('../../../share/protocol.ts').AnalyzeResponse>}
 */
export async function runAnalysis(body) {
  const res = await apiFetch("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

/** @deprecated 改用 runAnalysis */
export const runClustering = runAnalysis;

/**
 * POST /api/export —— 导出数据为文件
 *
 * @param {{ session_id: string, format?: 'csv'|'excel' }} body
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function exportData(body) {
  const res = await apiFetch("/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const blob = await res.blob();

  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `exported_data.${body.format || "csv"}`;

  return { blob, filename };
}

/**
 * GET /api/health —— 健康检查
 *
 * @returns {Promise<import('../../../share/protocol.ts').HealthResponse>}
 */
export async function checkHealth() {
  const res = await apiFetch("/health", { method: "GET" });
  return res.json();
}

/**
 * GET /api/history —— 获取历史记录
 *
 * @param {{ limit?: number, offset?: number }} [params]
 * @returns {Promise<import('../../../share/protocol.ts').HistoryResponse>}
 */
export async function getHistory(params = {}) {
  const query = new URLSearchParams();
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.offset != null) query.set("offset", String(params.offset));
  const qs = query.toString();
  const url = `/history${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { method: "GET" });
  return res.json();
}

/**
 * GET /api/session/{session_id} —— 加载历史会话
 *
 * @param {string} sessionId
 * @returns {Promise<import('../../../share/protocol.ts').SessionLoadResponse>}
 */
export async function loadSession(sessionId) {
  const res = await apiFetch(`/session/${sessionId}`, { method: "GET" });
  return res.json();
}
