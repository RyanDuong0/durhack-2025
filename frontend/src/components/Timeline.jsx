import React, { useState, useRef } from "react";
import "../index.css";

const Timeline = ({ trends, startYear = 2015, onSubmit, prompt = "" }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: "" });
  const [submittedRange, setSubmittedRange] = useState(null);
  const svgRef = useRef(null);

  if (!trends || trends.length === 0) {
    return <div className="timeline-empty">No trend data available</div>;
  }

  // timestamps and spans
  const timestamps = trends.map((t) => t.date.getTime());
  const trendsMin = Math.min(...timestamps);
  const trendsMax = Math.max(...timestamps);
  const forcedStart = new Date(startYear, 0, 1).getTime();
  const minTimestamp = Math.min(trendsMin, forcedStart);
  const maxTimestamp = trendsMax;
  const timeSpan = Math.max(1, maxTimestamp - minTimestamp);

  const maxScore = Math.max(...trends.map((t) => t.score)) || 1;

  // SVG coordinate system
  const viewW = 1000;
  const viewH = 160;
  const chartPadding = { left: 40, right: 20, top: 12, bottom: 34 };
  const chartW = viewW - chartPadding.left - chartPadding.right;
  const chartH = viewH - chartPadding.top - chartPadding.bottom;

  const xFor = (ts) => {
    const ratio = (ts - minTimestamp) / timeSpan;
    return chartPadding.left + Math.max(0, Math.min(1, ratio)) * chartW;
  };
  const heightFor = (score) => {
    return Math.max(2, (score / maxScore) * (chartH - 6));
  };

  // ticks: one tick per year between the forced start and final year
  const startYearVal = new Date(minTimestamp).getFullYear();
  const endYearVal = new Date(maxTimestamp).getFullYear();
  const years = [];
  for (let y = startYearVal; y <= endYearVal; y++) years.push(y);

  const handleSvgClick = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // ratio relative to the drawn chart inside the svg rectangle
    const leftPx = (chartPadding.left / viewW) * rect.width;
    const chartPx = (chartW / viewW) * rect.width;
    const ratio = Math.max(0, Math.min(1, (x - leftPx) / chartPx));
    const clickedTimestamp = minTimestamp + ratio * timeSpan;
    setSelectedDate(new Date(clickedTimestamp));
  };

  const handlePeakHover = (event, trend) => {
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 8,
      content: `${trend.topic} — ${trend.date.toLocaleDateString()} — score ${trend.score}`,
    });
  };

  const handlePeakMove = (event) => {
    if (!tooltip.visible) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip((t) => ({ ...t, x: event.clientX - rect.left, y: event.clientY - rect.top - 8 }));
  };

  const handlePeakLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: "" });
  };

  const formatSelected = (d) => (d ? d.toLocaleDateString() : "—");

  // compute selected range ~ +/- 1.5 months -> approximate 45 days each way (3 month total)
  const getDateRangeForSelection = (date) => {
    if (!date) return null;
    const msPerDay = 24 * 60 * 60 * 1000;
    const delta = Math.round(45 * msPerDay); // ~1.5 months
    return {
      before: new Date(date.getTime() - delta),
      after: new Date(date.getTime() + delta),
    };
  };

  const getWholeRange = () => {
    return { before: new Date(minTimestamp), after: new Date(maxTimestamp) };
  };

  const dateRange = getDateRangeForSelection(selectedDate);

  // Submit handler: if user didn't select -> use full range, otherwise 3-month range around selection.
  const handleSubmit = () => {
    const rangeToUse = selectedDate ? getDateRangeForSelection(selectedDate) : getWholeRange();
    setSubmittedRange(rangeToUse);

    // Forward both range and prompt to parent if provided
    if (typeof onSubmit === "function") {
      try {
        onSubmit(rangeToUse, prompt);
      } catch (err) {
        console.error("onSubmit callback error:", err);
      }
    } else {
      // default: log to console
      console.log("Submitted timeline range and prompt:", rangeToUse, prompt);
    }
  };

  const handleReset = () => {
    setSelectedDate(null);
    setSubmittedRange(null);
    setTooltip({ visible: false, x: 0, y: 0, content: "" });
  };

  return (
    <div className="timeline-wrapper">
      <div className="timeline-card">
        <svg
          ref={svgRef}
          className="timeline-svg"
          viewBox={`0 0 ${viewW} ${viewH}`}
          preserveAspectRatio="xMidYMid meet"
          onClick={handleSvgClick}
        >
          <defs>
            <linearGradient id="bgGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#f8fbff" />
              <stop offset="100%" stopColor="#eef6ff" />
            </linearGradient>
            <linearGradient id="peakGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2d8cf0" />
              <stop offset="100%" stopColor="#4aa6ff" />
            </linearGradient>
            <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.12" />
            </filter>
          </defs>

          <rect x="0" y="0" width={viewW} height={viewH} rx="8" fill="url(#bgGrad)" />

          <line
            x1={chartPadding.left}
            x2={viewW - chartPadding.right}
            y1={viewH - chartPadding.bottom}
            y2={viewH - chartPadding.bottom}
            stroke="#d6e7ff"
            strokeWidth={2}
          />

          {years.map((yr) => {
            const ts = new Date(yr, 0, 1).getTime();
            const x = xFor(ts);
            return (
              <g key={yr} className="year-tick">
                <line x1={x} x2={x} y1={viewH - chartPadding.bottom} y2={viewH - chartPadding.bottom + 10} stroke="#cbdff7" />
                <text x={x} y={viewH - 6} fontSize="11" textAnchor="middle" fill="#4a6f9b">
                  {yr}
                </text>
              </g>
            );
          })}

          {trends.map((trend, i) => {
            const x = xFor(trend.date.getTime());
            const h = heightFor(trend.score);
            const barW = 6;
            const y = viewH - chartPadding.bottom - h;
            return (
              <rect
                key={i}
                className="timeline-peak"
                x={x - barW / 2}
                y={y}
                width={barW}
                height={h}
                rx="2"
                fill="url(#peakGrad)"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.8"
                filter="url(#softShadow)"
                onMouseEnter={(e) => handlePeakHover(e, trend)}
                onMouseMove={handlePeakMove}
                onMouseLeave={handlePeakLeave}
                style={{ cursor: "pointer" }}
              />
            );
          })}

          {selectedDate && (
            <>
              <line
                x1={xFor(selectedDate.getTime())}
                x2={xFor(selectedDate.getTime())}
                y1={chartPadding.top}
                y2={viewH - chartPadding.bottom + 2}
                stroke="#ff6b6b"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <circle cx={xFor(selectedDate.getTime())} cy={chartPadding.top + 8} r={6} fill="#ff6b6b" stroke="#fff" strokeWidth="1" />
            </>
          )}
        </svg>

        {tooltip.visible && (
          <div
            className="timeline-tooltip"
            style={{
              left: `${(tooltip.x / viewW) * 100}%`,
              top: `${(tooltip.y / viewH) * 100}%`,
              transform: "translate(-50%, -120%)",
            }}
          >
            {tooltip.content}
          </div>
        )}

        <div className="timeline-info">
          <div className="timeline-info-left">
            <div className="info-label">Selected</div>
            <div className="info-value">{formatSelected(selectedDate)}</div>
            {dateRange && <div className="info-sub">Range: {dateRange.before.toLocaleDateString()} — {dateRange.after.toLocaleDateString()}</div>}
            {!selectedDate && <div className="info-sub">No selection — submit will use full timeline range</div>}
            {submittedRange && (
              <div className="info-sub" style={{ marginTop: 8, color: "#155e75" }}>
                Submitted: {submittedRange.before.toLocaleDateString()} — {submittedRange.after.toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="timeline-info-right">
            <div className="legend-item">
              <span className="legend-dot legend-dot-peak" /> Peak
            </div>
            <div className="legend-item">
              <span className="legend-dot legend-dot-selected" /> Selected
            </div>

            <div className="timeline-actions">
                {/* Button to Reset the timeline */}
              <button
                type="button"
                className="td-btn td-btn-secondary"
                onClick={handleReset}
                title="Deselect timeline"
                aria-label="Reset timeline selection"
              >
                Reset
              </button>

                {/* Button to Submit the timeline */}
              <button
                type="button"
                className="td-btn td-btn-primary"
                onClick={handleSubmit}
                title="Submit timeline range"
                aria-label="Submit timeline range"
                disabled={false}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Timeline;