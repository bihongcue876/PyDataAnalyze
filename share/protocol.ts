/**
 * PyDataAnalyze 前后端接口契约 —— TypeScript 类型定义
 *
 * 与 protocol.md v1.2 一致，是前端代码的唯一导入源。
 *
 * @version 1.2
 * @date 2026-06-06
 */

// ============================================================
// 1. 通用类型
// ============================================================

/** 一条列描述 */
export interface ColumnInfo {
  name: string;
  dtype: string; // pandas dtype: "int64" | "float64" | "object" | "bool" | "datetime64[ns]" ...
}

/** API 错误响应体 */
export interface ApiError {
  error: string;
}

// ============================================================
// 2. 图表数据类型
// ============================================================

/** 用户可请求的图表类型（用于 ChartRequest.chart_type） */
export type ChartType = "histogram" | "scatter" | "box" | "bar" | "pie" | "line" | "heatmap" | "scatter_matrix";

/** 响应中 ChartData 的判别键（包含仅由后端生成的 cluster_scatter） */
export type ChartDataType = ChartType | "cluster_scatter";

export interface HistogramDatum {
  label: string;
  value: number;
}

export interface ScatterDatum {
  x: number;
  y: number;
}

/** 聚类散点图数据点（比普通散点多一个 cluster 字段） */
export interface ClusterScatterDatum extends ScatterDatum {
  cluster: number;
}

export interface BoxDatum {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

export interface BarDatum {
  label: string;
  value: number;
}

export interface PieDatum {
  label: string;
  value: number;
}

export interface HeatmapDatum {
  x: string;
  y: string;
  value: number;
}

/** 散点矩阵的一个子图 */
export interface ScatterPanel {
  x_col: string;
  y_col: string;
  data: ScatterDatum[];
}

/**
 * 统一的图表数据对象 —— discriminated union
 *
 * TypeScript 根据 chart_type 自动收窄 data 类型。
 */
export type ChartData =
  | {
      chart_type: "histogram";
      data: HistogramDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "scatter";
      data: ScatterDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "box";
      data: BoxDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "bar";
      data: BarDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "cluster_scatter";
      data: ClusterScatterDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "pie";
      data: PieDatum[];
      title?: string;
    }
  | {
      chart_type: "line";
      data: ScatterDatum[]; // same shape as scatter but sorted by x
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "heatmap";
      data: HeatmapDatum[];
      x_label?: string;
      y_label?: string;
      title?: string;
    }
  | {
      chart_type: "scatter_matrix";
      panels: ScatterPanel[];
      title?: string;
      color_column?: string; // optional, if present each scatter datum may carry a cluster field
    };

// ============================================================
// 3. API 请求体
// ============================================================

/** POST /api/clean */
export interface CleanRequest {
  session_id: string;
  fill_missing: boolean;
  fill_strategy: "mean" | "median" | "mode" | "drop";
  remove_outliers: boolean;
  /** 检测异常值的列名列表。空数组 = 对所有数值列检测（仅 remove_outliers=true 时有效） */
  outlier_columns: string[];
  outlier_method: "iqr" | "zscore";
  drop_duplicates: boolean;
}

/** POST /api/chart */
export interface ChartRequest {
  session_id: string;
  chart_type: ChartType;
  x_column?: string;      // histogram/scatter/bar/pie/line 时使用
  y_column?: string;      // scatter/bar/line 时使用
  columns?: string[];     // box/heatmap/scatter_matrix 时使用
  color_column?: string;  // 可选，用于 scatter / scatter_matrix 着色
}

/** 分析方法枚举 */
export type AnalysisMethod = "kmeans" | "dbscan" | "agglomerative" | "pca";

/** POST /api/analyze */
export interface AnalyzeRequest {
  session_id: string;
  method: AnalysisMethod;
  columns: string[];
  params?: {
    n_clusters?: number;     // kmeans / agglomerative 时有效
    eps?: number;            // dbscan 时有效
    min_samples?: number;    // dbscan 时有效
    n_components?: number;   // pca 时有效
  };
  plot_x?: string;   // 可选，默认 columns[0]
  plot_y?: string;   // 可选，默认 columns[1]
}

/** POST /api/export */
export interface ExportRequest {
  session_id: string;
  format?: "csv" | "excel"; // 默认 "csv"
}

// ============================================================
// 4. API 响应体
// ============================================================

/** POST /api/upload —— 成功响应 */
export interface UploadResponse {
  session_id: string;
  filename: string;
  rows: number;
  cols: number;
  columns: ColumnInfo[];
  preview: Record<string, unknown>[]; // 前 20 行，NaN → null
}

/** POST /api/clean —— 成功响应 */
export interface CleanResponse {
  operations: string[];
  rows: number;
  cols: number;
  columns: ColumnInfo[];
  preview: Record<string, unknown>[]; // NaN → null
}

/** POST /api/chart —— 成功响应（直接返回 ChartData，无包装键） */
export type ChartResponse = ChartData;

/** 聚类结果中单个簇的摘要 */
export interface ClusterSummaryItem {
  count: number;
  mean: Record<string, number>;
}

/** 分析评估指标 */
export interface AnalysisMetrics {
  silhouette_score?: number;
  calinski_harabasz_score?: number;
  davies_bouldin_score?: number;
  explained_variance_ratio?: number[]; // PCA
  [key: string]: unknown;
}

/** POST /api/analyze —— 成功响应 */
export interface AnalyzeResponse {
  method: AnalysisMethod;
  columns: ColumnInfo[];        // 更新后的列信息（含新增的 cluster 或 PC 列）
  chart_data: ChartData;        // 散点图 / 聚类散点图 / PCA 散点图等
  inertia?: number;             // kmeans 时
  centers?: number[][];         // kmeans / agglomerative 时
  summary?: Record<string, ClusterSummaryItem>; // 聚类方法时
  metrics?: AnalysisMetrics;    // 评估指标
}

/** 上传历史记录项 */
export interface UploadHistoryItem {
  id: number;
  session_id: string;
  filename: string;
  upload_time: string;  // ISO 8601
  rows: number;
  cols: number;
}

/** 分析历史记录项 */
export interface AnalysisHistoryItem {
  id: number;
  session_id: string;
  method: string;       // "kmeans", "dbscan" 等
  params_json: string;  // JSON 字符串，前端自行解析
  inertia: number | null;
  created_at: string;   // ISO 8601
}

/** GET /api/history —— 成功响应 */
export interface HistoryResponse {
  uploads: UploadHistoryItem[];
  analyses: AnalysisHistoryItem[];
}

/** GET /api/session/{session_id} —— 成功响应 */
export interface SessionLoadResponse {
  session_id: string;
  rows: number;
  cols: number;
  columns: ColumnInfo[];
  preview: Record<string, unknown>[];
}

/** GET /api/health —— 成功响应 */
export interface HealthResponse {
  status: "ok";
}

// ============================================================
// 5. 状态枚举
// ============================================================

/** 清洗填充策略 */
export type FillStrategy = CleanRequest["fill_strategy"];

/** 异常值检测方法 */
export type OutlierMethod = CleanRequest["outlier_method"];

/** 导出文件格式 */
export type ExportFormat = Exclude<ExportRequest["format"], undefined>;

// ============================================================
// 6. API 客户端常量与类型映射
// ============================================================

/** 文件上传大小上限（字节），与协议一致 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** 各端点路径常量 */
export const API = {
  UPLOAD: "/api/upload",
  CLEAN: "/api/clean",
  CHART: "/api/chart",
  ANALYZE: "/api/analyze",
  EXPORT: "/api/export",
  HEALTH: "/api/health",
  HISTORY: "/api/history",
  /** 加载历史会话的基础路径，使用时拼接 session_id，如 `${API.SESSION_LOAD}${id}` */
  SESSION_LOAD: "/api/session/",
} as const;

/** API 方法的请求-响应映射（类型层面） */
export interface ApiMap {
  [API.UPLOAD]: { req: FormData; res: UploadResponse };
  [API.CLEAN]: { req: CleanRequest; res: CleanResponse };
  [API.CHART]: { req: ChartRequest; res: ChartData };
  [API.ANALYZE]: { req: AnalyzeRequest; res: AnalyzeResponse };
  [API.EXPORT]: { req: ExportRequest; res: Blob };
  [API.HEALTH]: { req: void; res: HealthResponse };
  [API.HISTORY]: { req: void; res: HistoryResponse };
  [API.SESSION_LOAD]: { req: void; res: SessionLoadResponse };
}