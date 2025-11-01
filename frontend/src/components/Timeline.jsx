import React, { useState, useRef } from "react";
import "../index.css";

const Timeline = ({ trends, startYear = 2016, startMonth = 3, onSubmit, onReset, prompt = "" }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });
  const [submittedRange, setSubmittedRange] = useState(null);
  const svgRef = useRef(null);

  if (!trends || trends.length === 0) {
    return <div className="timeline-empty">No trend data available</div>;
  }

  // Force timeline bounds: startYear/startMonth (default Apr 1, 2016) through now
  const forcedStart = new Date(startYear, startMonth, 1).getTime(); // default month 3 => April
  const now = Date.now();
  const minTimestamp = forcedStart;
  const maxTimestamp = now;
  const timeSpan = Math.max(1, maxTimestamp - minTimestamp);

  // Only render peaks that fall inside [forcedStart, now]
  const filteredTrends = trends.filter(
    (t) => t.date.getTime() >= minTimestamp && t.date.getTime() <= maxTimestamp
  );

  // If no peaks in the forced range, show a helpful empty state
  if (filteredTrends.length === 0) {
    return (
      <div className="timeline-empty">
        No trend data available (after {new Date(minTimestamp).toLocaleDateString()})
      </div>
    );
  }

  // Compute max score from filtered trends for proper vertical scaling
  const maxScore = filteredTrends.length > 0 ? Math.max(...filteredTrends.map((t) => t.score)) : 1;

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

  // ticks: one tick per year between the forced start and final year (now)
  const startYearVal = new Date(minTimestamp).getFullYear();
  const endYearVal = new Date(maxTimestamp).getFullYear();
  const years = [];
  for (let y = startYearVal; y <= endYearVal; y++) years.push(y);

  // Helper: convert client mouse event to SVG coordinate (viewBox coordinate)
  const clientToSvgPoint = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm) {
      const rect = svg.getBoundingClientRect();
      const rx = (clientX - rect.left) / rect.width;
      const ry = (clientY - rect.top) / rect.height;
      return {
        x: rx * viewW,
        y: ry * viewH,
      };
    }
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleSvgClick = (e) => {
    const svgPoint = clientToSvgPoint(e.clientX, e.clientY);
    if (!svgPoint) return;

    // map svgPoint.x to timestamp
    const x = svgPoint.x;
    const ratio = Math.max(0, Math.min(1, (x - chartPadding.left) / chartW));
    const clickedTimestamp = minTimestamp + ratio * timeSpan;
    setSelectedDate(new Date(clickedTimestamp));
  };

  const handlePeakHover = (event, trend) => {
    const svgPoint = clientToSvgPoint(event.clientX, event.clientY);
    const content = `${trend.topic} — ${trend.date.toLocaleDateString()} — score ${trend.score}`;
    if (svgPoint) {
      setTooltip({
        visible: true,
        x: svgPoint.x,
        y: svgPoint.y,
        content,
      });
    } else {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 8,
        content,
      });
    }
  };

  const handlePeakMove = (event) => {
    if (!tooltip.visible) return;
    const svgPoint = clientToSvgPoint(event.clientX, event.clientY);
    if (svgPoint) {
      setTooltip((t) => ({ ...t, x: svgPoint.x, y: svgPoint.y }));
    } else {
      const rect = svgRef.current.getBoundingClientRect();
      setTooltip((t) => ({
        ...t,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 8,
      }));
    }
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
    const rangeToUse = selectedDate
      ? getDateRangeForSelection(selectedDate)
      : getWholeRange();
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

    // notify parent that timeline was reset so parent can clear its UI/state as needed
    if (typeof onReset === "function") {
      try {
        onReset();
      } catch (err) {
        console.error("onReset callback error:", err);
      }
    }
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
            <filter
              id="softShadow"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="4"
                floodOpacity="0.12"
              />
            </filter>
          </defs>

          <rect
            x="0"
            y="0"
            width={viewW}
            height={viewH}
            rx="8"
            fill="url(#bgGrad)"
          />

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
                <line
                  x1={x}
                  x2={x}
                  y1={viewH - chartPadding.bottom}
                  y2={viewH - chartPadding.bottom + 10}
                  stroke="#cbdff7"
                />
                <text
                  x={x}
                  y={viewH - 6}
                  fontSize="11"
                  textAnchor="middle"
                  fill="#4a6f9b"
                >
                  {yr}
                </text>
              </g>
            );
          })}

          {filteredTrends.map((trend, i) => {
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
              <circle
                cx={xFor(selectedDate.getTime())}
                cy={chartPadding.top + 8}
                r={6}
                fill="#ff6b6b"
                stroke="#fff"
                strokeWidth="1"
              />
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
            {selectedDate && <div className="info-label">Selected</div> }
            {selectedDate && <div className="info-value">{formatSelected(selectedDate)}</div> }
            {dateRange && (
              <div className="info-sub">
                Range: {dateRange.before.toLocaleDateString()} —{" "}
                {dateRange.after.toLocaleDateString()}
              </div>
            )}
            {!selectedDate && (
              <div className="info-sub">
                No selection — submit will use full timeline range
              </div>
            )}
            {submittedRange && (
              <div
                className="info-sub"
                style={{ marginTop: 8, color: "#155e75" }}
              >
                Submitted: {submittedRange.before.toLocaleDateString()} —{" "}
                {submittedRange.after.toLocaleDateString()}
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
              <button
                type="button"
                className="td-btn td-btn-secondary"
                onClick={handleReset}
                title="Deselect timeline"
                aria-label="Reset timeline selection"
              >
                Reset
              </button>

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