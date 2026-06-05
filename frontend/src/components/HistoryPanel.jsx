import React, { useEffect } from "react";

/**
 * HistoryPanel —— 历史记录列表 + 会话加载
 *
 * Props:
 *   historyData     — { uploads: [], analyses: [] } | null
 *   onLoadHistory   — (params?) => void
 *   onLoadSession   — (sessionId) => void
 *   isLoading       — 全局加载状态
 *   setError        — 设置全局错误
 */

function HistoryPanel({ historyData, onLoadHistory, onLoadSession, isLoading, setError }) {
  // 挂载时自动加载历史
  useEffect(() => {
    onLoadHistory();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSessionClick = async (sessionId) => {
    if (isLoading) return;
    try {
      await onLoadSession(sessionId);
    } catch (err) {
      setError(err.message);
    }
  };

  const uploads = historyData?.uploads || [];
  const analyses = historyData?.analyses || [];

  return (
    <div className="card section-card">
      <div className="card-header">
        <span className="step-badge" style={{ background: "#607d8b" }}>📋</span>
        历史记录
      </div>
      <div className="card-body">
        {uploads.length === 0 && analyses.length === 0 ? (
          <p className="small text-muted mb-0">暂无历史记录</p>
        ) : (
          <>
            {/* 上传历史 */}
            {uploads.length > 0 && (
              <div className="mb-3">
                <h6 className="small fw-semibold text-muted mb-2">
                  上传记录 ({uploads.length})
                </h6>
                <div className="table-responsive">
                  <table className="table table-sm table-hover small mb-0">
                    <thead>
                      <tr>
                        <th>文件名</th>
                        <th>行数</th>
                        <th>列数</th>
                        <th>时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((u) => (
                        <tr key={u.id || u.session_id}>
                          <td>{u.filename}</td>
                          <td>{u.rows}</td>
                          <td>{u.cols}</td>
                          <td style={{ fontSize: "0.75rem" }}>
                            {u.upload_time ? new Date(u.upload_time).toLocaleString() : "-"}
                          </td>
                          <td>
                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => handleSessionClick(u.session_id)}
                              disabled={isLoading}
                              style={{ fontSize: "0.7rem" }}
                            >
                              加载
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 分析历史 */}
            {analyses.length > 0 && (
              <div>
                <h6 className="small fw-semibold text-muted mb-2">
                  分析记录 ({analyses.length})
                </h6>
                <div className="table-responsive" style={{ maxHeight: 200, overflowY: "auto" }}>
                  <table className="table table-sm small mb-0">
                    <thead>
                      <tr>
                        <th>会话</th>
                        <th>方法</th>
                        <th>参数</th>
                        <th>时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyses.map((a) => (
                        <tr key={a.id}>
                          <td style={{ fontSize: "0.7rem", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.session_id?.slice(0, 8)}...
                          </td>
                          <td>{a.method}</td>
                          <td style={{ fontSize: "0.7rem", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {a.params_json}
                          </td>
                          <td style={{ fontSize: "0.7rem" }}>
                            {a.created_at ? new Date(a.created_at).toLocaleString() : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* 刷新按钮 */}
        <div className="mt-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => onLoadHistory()}
            disabled={isLoading}
          >
            {isLoading ? "刷新中..." : "刷新历史"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default HistoryPanel;
