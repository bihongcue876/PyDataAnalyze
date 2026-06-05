import React, { useState, useMemo } from "react";
import ChartRenderer from "./ChartRenderer";

/**
 * Visualization —— 图表配置与生成（支持 8 种图表类型）
 *
 * Props:
 *   sessionId        — 会话 ID
 *   columns          — ColumnInfo[]
 *   onChartGenerated — (chartReq) => void
 *   chartData        — ChartData | null
 *   isLoading        — 全局加载状态
 *   setError         — 设置全局错误
 */

const CHART_TYPES = [
  { value: "histogram", label: "直方图", icon: "📊" },
  { value: "scatter", label: "散点图", icon: "🔵" },
  { value: "box", label: "箱线图", icon: "📦" },
  { value: "bar", label: "柱状图", icon: "📈" },
  { value: "pie", label: "饼图", icon: "🥧" },
  { value: "line", label: "折线图", icon: "📉" },
  { value: "heatmap", label: "热力图", icon: "🔥" },
  { value: "scatter_matrix", label: "散点矩阵", icon: "🔲" },
];

/** 判断 dtype 是否为数值类型 */
function isNumeric(dtype) {
  return dtype.includes("int") || dtype.includes("float");
}

function Visualization({ sessionId, columns, onChartGenerated, chartData, isLoading, setError }) {
  // ---- 局部状态 ----
  const [chartType, setChartType] = useState("histogram");
  const [xColumn, setXColumn] = useState("");
  const [yColumn, setYColumn] = useState("");
  const [boxColumns, setBoxColumns] = useState([]);
  const [colorColumn, setColorColumn] = useState("");

  // ---- 派生数据 ----
  const numericColumns = useMemo(() => columns.filter((c) => isNumeric(c.dtype)), [columns]);
  const allColumnNames = useMemo(() => columns.map((c) => c.name), [columns]);
  const numericColumnNames = useMemo(() => numericColumns.map((c) => c.name), [numericColumns]);

  /** 散点图/散点矩阵需要分类列用于 color_column */
  const categoricalColumns = useMemo(
    () => columns.filter((c) => !isNumeric(c.dtype)).map((c) => c.name),
    [columns],
  );

  // ---- 验证 ----
  const validation = useMemo(() => {
    switch (chartType) {
      case "histogram":
        if (!xColumn) return { valid: false, hint: "请选择 X 轴数值列" };
        if (!isNumeric(columns.find((c) => c.name === xColumn)?.dtype || "")) {
          return { valid: false, hint: "直方图 X 轴需要选择数值列" };
        }
        return { valid: true, hint: "" };
      case "scatter":
        if (!xColumn) return { valid: false, hint: "请选择 X 轴列" };
        if (!yColumn) return { valid: false, hint: "请选择 Y 轴列" };
        return { valid: true, hint: "" };
      case "box":
        if (boxColumns.length === 0) return { valid: false, hint: "请至少选择一个数值列" };
        return { valid: true, hint: "" };
      case "bar":
        if (!xColumn) return { valid: false, hint: "请选择 X 轴列" };
        return { valid: true, hint: "" };
      case "pie":
        if (!xColumn) return { valid: false, hint: "请选择统计列" };
        return { valid: true, hint: "" };
      case "line":
        if (!xColumn) return { valid: false, hint: "请选择 X 轴数值列" };
        if (!yColumn) return { valid: false, hint: "请选择 Y 轴数值列" };
        return { valid: true, hint: "" };
      case "heatmap":
        if (boxColumns.length < 2) return { valid: false, hint: "请至少选择 2 个数值列" };
        return { valid: true, hint: "" };
      case "scatter_matrix":
        if (boxColumns.length < 2) return { valid: false, hint: "请至少选择 2 个数值列" };
        return { valid: true, hint: "" };
      default:
        return { valid: false, hint: "" };
    }
  }, [chartType, xColumn, yColumn, boxColumns, columns]);

  // ---- 事件处理 ----
  const handleChartTypeChange = (type) => {
    if (type === chartType) return;
    setChartType(type);
    setXColumn("");
    setYColumn("");
    setBoxColumns([]);
    setColorColumn("");
  };

  const handleBoxColumnToggle = (colName) => {
    setBoxColumns((prev) =>
      prev.includes(colName) ? prev.filter((c) => c !== colName) : [...prev, colName],
    );
  };

  const handleSelectAllBoxCols = () => {
    if (boxColumns.length === numericColumns.length) {
      setBoxColumns([]);
    } else {
      setBoxColumns(numericColumns.map((c) => c.name));
    }
  };

  const handleGenerate = async () => {
    if (!validation.valid || !sessionId) return;

    const req = {
      session_id: sessionId,
      chart_type: chartType,
    };

    switch (chartType) {
      case "histogram":
      case "pie":
        req.x_column = xColumn;
        break;
      case "scatter":
        req.x_column = xColumn;
        req.y_column = yColumn;
        if (colorColumn) req.color_column = colorColumn;
        break;
      case "line":
        req.x_column = xColumn;
        req.y_column = yColumn;
        break;
      case "bar":
        req.x_column = xColumn;
        if (yColumn) req.y_column = yColumn;
        break;
      case "box":
      case "heatmap":
      case "scatter_matrix":
        req.columns = boxColumns;
        if (chartType === "scatter_matrix" && colorColumn) req.color_column = colorColumn;
        break;
    }

    await onChartGenerated(req);
  };

  // ---- 列选择器渲染 ----
  const needsXColumn = ["histogram", "scatter", "bar", "pie", "line"].includes(chartType);
  const needsYColumn = ["scatter", "line"].includes(chartType);
  const needsBarY = chartType === "bar";
  const needsMultiCol = ["box", "heatmap", "scatter_matrix"].includes(chartType);
  const needsColor = chartType === "scatter" || chartType === "scatter_matrix";

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: "#1a73e8" }}>3</span>
        数据可视化
      </div>
      <div className="card-body">
        {/* ======== 图表类型选择 ======== */}
        <label className="form-label fw-semibold small">图表类型</label>
        <div className="chart-type-selector">
          {CHART_TYPES.map((ct) => (
            <button
              key={ct.value}
              className={`chart-type-btn ${chartType === ct.value ? "active" : ""}`}
              onClick={() => handleChartTypeChange(ct.value)}
              type="button"
            >
              <span className="me-1">{ct.icon}</span>
              {ct.label}
            </button>
          ))}
        </div>

        {/* ======== 列选择器 ======== */}
        <div className="row g-3 mb-3">
          {needsXColumn && (
            <div className={needsYColumn || needsBarY ? "col-md-6" : "col-md-6"}>
              <label className="form-label small text-muted">
                X 轴{chartType === "pie" ? "（统计列）" : chartType === "histogram" ? "（数值列）" : ""}
              </label>
              <select
                className="form-select form-select-sm"
                value={xColumn}
                onChange={(e) => setXColumn(e.target.value)}
              >
                <option value="">-- 选择列 --</option>
                {(chartType === "histogram" || chartType === "line"
                  ? numericColumnNames
                  : allColumnNames
                ).map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {chartType === "histogram" && (
                <small className="text-muted">展示数值列的分布</small>
              )}
              {chartType === "pie" && (
                <small className="text-muted">统计各类别频次</small>
              )}
            </div>
          )}

          {(needsYColumn || needsBarY) && (
            <div className="col-md-6">
              <label className="form-label small text-muted">
                Y 轴{needsBarY ? "（数值列，可选）" : "（数值列）"}
              </label>
              <select
                className="form-select form-select-sm"
                value={yColumn}
                onChange={(e) => setYColumn(e.target.value)}
              >
                <option value="">{needsBarY ? "-- 不选择（统计频次） --" : "-- 选择列 --"}</option>
                {numericColumnNames.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {needsBarY && (
                <small className="text-muted">选择后显示各类别均值</small>
              )}
            </div>
          )}

          {needsMultiCol && (
            <div className="col-12">
              <div className="d-flex justify-content-between align-items-center mb-1">
                <label className="form-label small text-muted mb-0">
                  选择数值列{chartType === "heatmap" ? "（至少 2 列）" : "（至少 2 列）"}
                </label>
                <button
                  className="btn btn-link btn-sm text-decoration-none p-0"
                  onClick={handleSelectAllBoxCols}
                  type="button"
                >
                  {boxColumns.length === numericColumns.length ? "取消全选" : "全选"}
                </button>
              </div>
              <div className="outlier-columns-list">
                {numericColumns.length > 0 ? (
                  numericColumns.map((col) => (
                    <div className="form-check form-check-inline" key={col.name}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`multicol-${col.name}`}
                        checked={boxColumns.includes(col.name)}
                        onChange={() => handleBoxColumnToggle(col.name)}
                      />
                      <label className="form-check-label small" htmlFor={`multicol-${col.name}`}>
                        {col.name}
                      </label>
                    </div>
                  ))
                ) : (
                  <span className="text-muted small">无可用数值列</span>
                )}
              </div>
            </div>
          )}

          {needsColor && categoricalColumns.length > 0 && (
            <div className="col-md-6">
              <label className="form-label small text-muted">着色列（可选）</label>
              <select
                className="form-select form-select-sm"
                value={colorColumn}
                onChange={(e) => setColorColumn(e.target.value)}
              >
                <option value="">-- 不着色 --</option>
                {categoricalColumns.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <small className="text-muted">按分类列着色数据点</small>
            </div>
          )}
        </div>

        {/* ======== 生成按钮 ======== */}
        <div className="d-flex align-items-center gap-2 mb-3">
          <button
            className="btn btn-primary px-4"
            onClick={handleGenerate}
            disabled={!validation.valid || isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                生成中...
              </>
            ) : (
              "生成图表"
            )}
          </button>
          {!validation.valid && validation.hint && (
            <small className="text-muted">{validation.hint}</small>
          )}
        </div>

        {/* ======== 图表渲染区 ======== */}
        <ChartRenderer chartData={chartData} />
      </div>
    </div>
  );
}

export default Visualization;
