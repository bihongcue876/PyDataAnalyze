/**
 * PyDataAnalyze API 客户端
 *
 * 严格遵循 share/protocol.md 契约 —— 前后端交互的唯一事实来源。
 * 6 个端点，基于原生 fetch，30 秒超时，自动错误解析。
 *
 * @see share/protocol.md
 * @see share/protocol.ts (TypeScript 类型参考)
 */

// ============================================================
// 基础配置
// ============================================================

/** Vite proxy 将 /api 转发到 localhost:8000，此处使用同源路径 */
const API_BASE = '/api';

/** 请求超时（毫秒） */
const TIMEOUT_MS = 30_000;

/** 上传文件大小上限（字节），与 protocol.md §3.1 一致 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

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
      // 尝试解析 { error: "..." } 响应体
      let errorMessage;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error || errorBody.detail;
      } catch {
        // 响应体不是 JSON（如 413 无 body）
        errorMessage = `请求失败 (HTTP ${response.status})`;
      }

      // 为常见状态码提供中文前缀
      switch (response.status) {
        case 400:
          throw new Error(errorMessage || '请求参数不合法');
        case 404:
          throw new Error(errorMessage || '会话不存在或已过期');
        case 413:
          throw new Error('文件大小超过 10MB 限制');
        case 500:
          throw new Error(errorMessage || '服务器内部错误');
        default:
          throw new Error(errorMessage || `请求失败 (HTTP ${response.status})`);
      }
    }

    return response;
  } catch (err) {
    // 超时或网络错误
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请检查后端是否运行');
    }
    if (err.name === 'TypeError' && err.message.includes('fetch')) {
      throw new Error('无法连接后端服务，请确认后端已启动');
    }
    // 已经是我们抛出的 Error（含中文消息），直接再抛出
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================
// 端点函数
// ============================================================

/**
 * POST /api/upload —— 上传 CSV/Excel 文件
 *
 * @param {File} file - 用户选择的文件
 * @returns {Promise<{
 *   session_id: string,
 *   filename: string,
 *   rows: number,
 *   cols: number,
 *   columns: Array<{name: string, dtype: string}>,
 *   preview: Record<string, unknown>[]
 * }>}
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/upload', {
    method: 'POST',
    body: formData,
    // 不设 Content-Type，让浏览器自动生成含 boundary 的 multipart/form-data
  });

  return res.json();
}

/**
 * POST /api/clean —— 执行数据清洗
 *
 * @param {{
 *   session_id: string,
 *   fill_missing: boolean,
 *   fill_strategy: 'mean'|'median'|'mode'|'drop',
 *   remove_outliers: boolean,
 *   outlier_columns: string[],
 *   outlier_method: 'iqr'|'zscore',
 *   drop_duplicates: boolean
 * }} body
 * @returns {Promise<{
 *   operations: string[],
 *   rows: number,
 *   cols: number,
 *   columns: Array<{name: string, dtype: string}>,
 *   preview: Record<string, unknown>[]
 * }>}
 */
export async function cleanData(body) {
  const res = await apiFetch('/clean', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * POST /api/chart —— 获取图表数据
 *
 * 按协议 §3.3，响应直接返回 ChartData 对象（无包装键）。
 *
 * @param {{
 *   session_id: string,
 *   chart_type: 'histogram'|'scatter'|'box'|'bar',
 *   x_column?: string,
 *   y_column?: string,
 *   columns?: string[]
 * }} body
 * @returns {Promise<import('../../../share/protocol.ts').ChartData>}
 */
export async function getChartData(body) {
  const res = await apiFetch('/chart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * POST /api/analyze —— 运行 K-Means 聚类分析
 *
 * @param {{
 *   session_id: string,
 *   columns: string[],
 *   n_clusters?: number,
 *   plot_x?: string,
 *   plot_y?: string
 * }} body
 * @returns {Promise<{
 *   inertia: number,
 *   n_clusters: number,
 *   columns: Array<{name: string, dtype: string}>,
 *   chart_data: object,
 *   centers: number[][],
 *   summary: Record<string, {count: number, mean: Record<string, number>}>
 * }>}
 */
export async function runClustering(body) {
  const res = await apiFetch('/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/**
 * POST /api/export —— 导出数据为文件
 *
 * 响应为文件二进制流。前端需读取 blob 并触发下载。
 *
 * @param {{ session_id: string, format?: 'csv'|'excel' }} body
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function exportData(body) {
  const res = await apiFetch('/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const blob = await res.blob();

  // 从 Content-Disposition 解析文件名，或使用默认名
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="?(.+?)"?$/);
  const filename = match ? match[1] : `exported_data.${body.format || 'csv'}`;

  return { blob, filename };
}

/**
 * GET /api/health —— 健康检查
 *
 * @returns {Promise<{ status: string }>}
 */
export async function checkHealth() {
  const res = await apiFetch('/health', { method: 'GET' });
  return res.json();
}
