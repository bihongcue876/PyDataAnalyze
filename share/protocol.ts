/**
 * PyDataAnalyze 前后端接口契约 —— TypeScript 类型定义
 *
 * 本文件与 protocol.md 一一对应，是前端代码的导入源。
 * 后端可用此文件生成 Pydantic 模型的参照（或将来用 OpenAPI 自动生成）。
 *
 * @version 1.0
 * @date 2026-06-04
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
export type ChartType = "histogram" | "scatter" | "box" | "bar";

/** 响应中 ChartData 的判别键（包含仅由后端生成的 cluster_scatter） */
export type ChartDataType = ChartType | "cluster_scatter";

/** 直方图数据点 */
export interface HistogramDatum {
  label: string;
  value: number;
}

/** 散点图数据点 */
export interface ScatterDatum {
  x: number;
  y: number;
}

/** 聚类散点图数据点（比普通散点多一个 cluster 字段） */
export interface ClusterScatterDatum extends ScatterDatum {
  cluster: number;
}

/** 箱线图数据点（一个变量一条） */
export interface BoxDatum {
  label: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  outliers: number[];
}

/** 柱状图数据点 */
export interface BarDatum {
  label: string;
  value: number;
}

/**
 * 统一的图表数据对象 —— discriminated union
 *
 * TypeScript 根据 chart_type 自动收窄 data 类型：
 *   chart_type === "histogram" → data 为 HistogramDatum[]
 *   chart_type === "scatter"   → data 为 ScatterDatum[]
 *   ...
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
  x_column?: string; // histogram/scatter/bar 时使用
  y_column?: string; // scatter 必填；bar 可选
  columns?: string[]; // box 时使用（多列并排箱线图），替代 x_column
}

/** POST /api/analyze */
export interface AnalyzeRequest {
  session_id: string;
  columns: string[]; // 参与聚类的数值列（≥2）
  n_clusters?: number; // 聚类数（默认 3，范围 [2, 10]）
  plot_x?: string; // 散点图 X 轴列名（默认 columns[0]）
  plot_y?: string; // 散点图 Y 轴列名（默认 columns[1]）
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

/** POST /api/analyze —— 成功响应 */
export interface AnalyzeResponse {
  inertia: number;
  n_clusters: number;
  columns: ColumnInfo[]; // 更新后的列信息（含新增的 "cluster" 列）
  chart_data: ChartData; // chart_type 固定为 "cluster_scatter"
  centers: number[][];
  summary: Record<string, ClusterSummaryItem>;
}

/** POST /api/export —— 返回文件流（blob），无 JSON 响应体 */

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
export type ExportFormat = ExportRequest["format"];

// ============================================================
// 6. API 客户端类型（可选——供 api.js / useApi.js 使用）
// ============================================================

/** 文件上传大小上限（字节），与 protocol.md §3.1 一致 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** 各端点路径常量 */
export const API = {
  UPLOAD: "/api/upload",
  CLEAN: "/api/clean",
  CHART: "/api/chart",
  ANALYZE: "/api/analyze",
  EXPORT: "/api/export",
  HEALTH: "/api/health",
} as const;

/** API 方法的请求-响应映射（类型层面） */
export interface ApiMap {
  [API.UPLOAD]: { req: FormData; res: UploadResponse };
  [API.CLEAN]: { req: CleanRequest; res: CleanResponse };
  [API.CHART]: { req: ChartRequest; res: ChartData };
  [API.ANALYZE]: { req: AnalyzeRequest; res: AnalyzeResponse };
  [API.EXPORT]: { req: ExportRequest; res: Blob };
  [API.HEALTH]: { req: void; res: HealthResponse };
}
