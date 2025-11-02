import { useState, useEffect } from "react";

function getBackendUrl() {
  // 1) runtime injection
  try {
    if (typeof window !== "undefined" && window.__BACKEND_URL__) {
      return window.__BACKEND_URL__;
    }
  } catch (e) {}

  // 2) process.env (CRA / some bundlers)
  try {
    if (typeof process !== "undefined" && process.env) {
      if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
      if (process.env.VITE_API_URL) return process.env.VITE_API_URL;
      if (process.env.API_URL) return process.env.API_URL;
    }
  } catch (e) {}

  // 3) Vite (import.meta) — only valid after bundling, guard so runtime doesn't blow up
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
  } catch (e) {}

  // final fallback
  return "http://127.0.0.1:8000";
}

const BACKEND_URL = getBackendUrl();

// Example trends data
const trends = [
  { date: new Date(2016, 3, 15), title: "Trend 1", volume: 1200 },
  { date: new Date(2017, 6, 20), title: "Trend 2", volume: 2400 },
  { date: new Date(2018, 9, 10), title: "Trend 3", volume: 1800 },
  { date: new Date(2019, 2, 5), title: "Trend 4", volume: 3200 },
  { date: new Date(2020, 11, 25), title: "Trend 5", volume: 2800 },
  { date: new Date(2021, 5, 18), title: "Trend 6", volume: 4100 },
  { date: new Date(2022, 8, 30), title: "Trend 7", volume: 3600 },
  { date: new Date(2023, 1, 14), title: "Trend 8", volume: 2900 },
  { date: new Date(2024, 4, 22), title: "Trend 9", volume: 5200 },
  { date: new Date(2025, 7, 8), title: "Trend 10", volume: 4800 },
];

function Timeline({ trends, startYear, startMonth, prompt, onSubmit, onReset, onRangeChange }) {
  const [selectedRange, setSelectedRange] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const startDate = new Date(startYear, startMonth - 1, 1);
  const now = new Date();
  const totalMonths = (now.getFullYear() - startYear) * 12 + (now.getMonth() - (startMonth - 1)) + 1;
  const totalBars = Math.ceil(totalMonths / 3);

  const bars = [];
  for (let i = 0; i < totalBars; i++) {
    const barStartMonth = startMonth - 1 + (i * 3);
    const barDate = new Date(startYear, barStartMonth, 1);
    const barEndDate = new Date(startYear, barStartMonth + 3, 0);

    const trendsInPeriod = trends.filter((t) => {
      const tDate = new Date(t.date);
      return tDate >= barDate && tDate <= barEndDate;
    });
    const volume = trendsInPeriod.reduce((sum, t) => sum + (t.volume || 0), 0);
    bars.push({ date: barDate, endDate: barEndDate, volume, index: i });
  }

  const maxVolume = Math.max(...bars.map((b) => b.volume), 1);

  const handleMouseDown = (index) => {
    setIsSelecting(true);
    setSelectionStart(index);
    const newRange = { start: index, end: index };
    setSelectedRange(newRange);
    if (onRangeChange) {
      onRangeChange({ 
        before: bars[index].date, 
        after: bars[index].endDate 
      });
    }
  };

  const handleMouseEnter = (index) => {
    setHoverIndex(index);
    if (isSelecting && selectionStart !== null) {
      const start = Math.min(selectionStart, index);
      const end = Math.max(selectionStart, index);
      const newRange = { start, end };
      setSelectedRange(newRange);
      if (onRangeChange) {
        onRangeChange({ 
          before: bars[start].date, 
          after: bars[end].endDate 
        });
      }
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleResetClick = () => {
    setSelectedRange(null);
    setSelectionStart(null);
    if (onRangeChange) {
      onRangeChange(null);
    }
    if (onReset) {
      onReset();
    }
  };

  useEffect(() => {
    if (isSelecting) {
      window.addEventListener("mouseup", handleMouseUp);
      return () => window.removeEventListener("mouseup", handleMouseUp);
    }
  }, [isSelecting]);

  return (
    <div style={{ width: "100%", maxWidth: 1100 }}>
      <div style={{ marginBottom: 20, userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-end", height: 180, gap: 2 }}>
          {bars.map((bar) => {
            const isSelected = selectedRange && bar.index >= selectedRange.start && bar.index <= selectedRange.end;
            const isHovered = hoverIndex === bar.index;
            const height = (bar.volume / maxVolume) * 150 + 20;

            return (
              <div
                key={bar.index}
                onMouseDown={() => handleMouseDown(bar.index)}
                onMouseEnter={() => handleMouseEnter(bar.index)}
                style={{
                  flex: 1,
                  height: `${height}px`,
                  backgroundColor: isSelected ? "#0f3b66" : "#6b7b8f",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  opacity: isSelected ? 1 : isHovered ? 0.8 : 0.5,
                  borderRadius: "2px 2px 0 0",
                }}
              />
            );
          })}
        </div>
        <div style={{ height: 2, backgroundColor: "#0f3b66", marginTop: 0 }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7b8f", marginTop: 6 }}>
          <span>{startYear}</span>
          <span>today</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button
          onClick={handleResetClick}
          style={{
            padding: "10px 20px",
            backgroundColor: "transparent",
            color: "#0f3b66",
            border: "1px solid #0f3b66",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#f0f4f8")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "transparent")}
        >
          Reset
        </button>
      </div>

      {selectedRange && (
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            color: "#0f3b66",
            padding: "8px 12px",
            backgroundColor: "#f0f4f8",
            borderRadius: 6,
          }}
        >
          Selected range: {bars[selectedRange.start].date.toLocaleDateString()} —{" "}
          {bars[selectedRange.end].endDate.toLocaleDateString()}
        </div>
      )}
    </div>
  );
}

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const [introStep, setIntroStep] = useState(0);
  const [teaTimeTransitioning, setTeaTimeTransitioning] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [selectedRange, setSelectedRange] = useState(null);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' && showIntro) {
        e.preventDefault();
        setShowIntro(false);
        setIntroStep(0);
        setTeaTimeTransitioning(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showIntro]);

  useEffect(() => {
    if (showIntro) {
      const timers = [
        setTimeout(() => setIntroStep(1), 500),
        setTimeout(() => setIntroStep(2), 1800),
        setTimeout(() => setIntroStep(3), 3200),
        setTimeout(() => setIntroStep(4), 4600),
        setTimeout(() => setIntroStep(5), 6000),
        setTimeout(() => setIntroStep(6), 7400),
        setTimeout(() => setIntroStep(7), 8900),
        setTimeout(() => setIntroStep(8), 10400),
        setTimeout(() => setIntroStep(9), 11800),
        setTimeout(() => setIntroStep(10), 13200),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [showIntro]);

  const handleStartClick = () => {
    setTeaTimeTransitioning(true);
    setTimeout(() => setShowIntro(false), 1800);
  };

  const replayIntro = () => {
    setShowIntro(true);
    setIntroStep(0);
    setTeaTimeTransitioning(false);
  };

  const handleTimelineSubmit = async (range, promptText) => {
    setResultMessage(null);
    setApiResponse(null);
    setLoading(true);

    try {
      const payload = {
        prompt: promptText || "",
        ...(range && {
          date_range: {
            start: range.before.toISOString(),
            end: range.after.toISOString()
          }
        })
      };

      const response = await fetch(`${BACKEND_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      setApiResponse(data);
      setResultMessage({
        type: "info",
        text: "Prediction received successfully",
      });
    } catch (error) {
      console.error("API Error:", error);
      setResultMessage({
        type: "error",
        text: `Error: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnterSubmit = () => {
    handleTimelineSubmit(selectedRange, prompt);
  };

  const handleTimelineReset = () => {
    setResultMessage(null);
    setApiResponse(null);
    setLoading(false);
    setSelectedRange(null);
    console.log("Timeline selection reset — parent cleared displayed prompt/range.");
  };

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes strikethroughGrow {
            from { width: 0; }
            to { width: 100%; }
          }
          @keyframes fadeInSlow {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>

      {/* Fixed Header */}
      {!showIntro && (
        <div
          style={{
            position: "sticky",
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: "white",
            zIndex: 1000,
            padding: "24px 0",
            borderBottom: "1px solid rgba(13,48,84,0.08)",
          }}
        >
          <h1
            style={{
              fontSize: "3.2rem",
              fontWeight: "500",
              margin: 0,
              textAlign: "center",
            }}
          >
            our Legacy
          </h1>
        </div>
      )}

      {/* Intro Overlay */}
      {showIntro && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "white",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 1.5s ease-out",
            opacity: teaTimeTransitioning ? 0 : 1,
            pointerEvents: showIntro ? "auto" : "none",
          }}
        >
          <div
            style={{
              textAlign: "center",
              position: "relative",
              minHeight: "300px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div>
              {introStep >= 1 && introStep < 2 && (
                <h1 style={{ fontSize: "3.6rem", margin: 0, animation: "fadeInUp 1.2s ease-out" }}>
                  our Legacy
                </h1>
              )}

              {introStep >= 2 && introStep < 3 && (
                <p style={{ fontSize: "2.16rem", margin: 0, animation: "fadeIn 1.2s ease-out" }}>
                  who decides it ?
                </p>
              )}

              {introStep >= 3 && introStep < 5 && (
                <div style={{ fontSize: "4.8rem", fontWeight: "bold", position: "relative", display: "inline-block", animation: "fadeIn 1.2s ease-out" }}>
                  <span style={{ position: "relative", display: "inline-block" }}>
                    𝕏
                    {introStep >= 4 && (
                      <span style={{ position: "absolute", top: "50%", left: 0, height: "4px", backgroundColor: "black", transform: "translateY(-50%)", animation: "strikethroughGrow 0.8s ease-out forwards" }} />
                    )}
                  </span>
                </div>
              )}

              {introStep >= 5 && introStep < 7 && (
                <p style={{ fontSize: "3.6rem", margin: 0, fontWeight: "600", color: "#1DA1F2", animation: "fadeIn 1.2s ease-out" }}>
                  Twitter
                </p>
              )}

              {introStep >= 7 && introStep < 8 && (
                <p style={{ fontSize: "2.16rem", margin: "20px 0 0 0", animation: "fadeIn 1.2s ease-out" }}>
                  History repeats itself
                </p>
              )}

              {introStep >= 8 && introStep < 9 && (
                <>
                  <p style={{ fontSize: "2.16rem", margin: "20px 0 0 0" }}>History repeats itself</p>
                  <p style={{ fontSize: "2.16rem", margin: "12px 0 0 0", animation: "fadeIn 1.2s ease-out" }}>and we tell it...</p>
                </>
              )}

              {introStep >= 9 && (
                <>
                  <p style={{ fontSize: "2.16rem", margin: "20px 0 0 0" }}>History repeats itself</p>
                  <p style={{ fontSize: "2.16rem", margin: "12px 0 0 0" }}>and we tell it...</p>
                  <h1 style={{ fontSize: "3.6rem", margin: "12px 0 0 0", fontWeight: "700", animation: "fadeIn 1.2s ease-out" }}>our Legacy</h1>
                </>
              )}
            </div>

            {introStep >= 10 && (
              <div style={{ marginTop: "60px", animation: "fadeIn 1s ease-out" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "80px", maxWidth: "1000px", alignItems: "start" }}>
                  <div style={{ fontSize: "15px", color: "#4a5568", lineHeight: "1.8", textAlign: "left", maxWidth: "520px" }}>
                    <p style={{ margin: "0 0 16px 0" }}>Ask and you shall receive, we'll predict what's in store for you using only relevant trending Twitter topics.</p>
                    <p style={{ margin: "0 0 16px 0" }}>Is there a timeline you're biased towards? Date back to the era, choosing a period on the timeline, and we'll keep just what's relevant to you.</p>
                    <p style={{ margin: 0 }}>Leave it blank to keep everything included.</p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "32px", textAlign: "left", marginTop: "20px" }}>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: "600", color: "#0f3b66" }}>Aug '25</div>
                      <div style={{ fontSize: "16px", color: "#4a5568", marginTop: "4px" }}>67</div>
                    </div>
                    <div style={{ marginLeft: "60px" }}>
                      <div style={{ fontSize: "20px", fontWeight: "600", color: "#0f3b66" }}>April '24</div>
                      <div style={{ fontSize: "16px", color: "#4a5568", marginTop: "4px" }}>TikTok ban</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: "600", color: "#0f3b66" }}>July '25</div>
                      <div style={{ fontSize: "16px", color: "#4a5568", marginTop: "4px" }}>💀 attempt</div>
                    </div>
                  </div>
                </div>

                {!teaTimeTransitioning && (
                  <div style={{ marginTop: "40px", textAlign: "center", animation: "fadeIn 1.5s ease-out 0.5s both" }}>
                    <button
                      onClick={handleStartClick}
                      style={{
                        padding: "14px 32px",
                        fontSize: "16px",
                        fontWeight: "600",
                        backgroundColor: "#0f3b66",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.backgroundColor = "#1a5490";
                        e.target.style.transform = "translateY(-2px)";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.backgroundColor = "#0f3b66";
                        e.target.style.transform = "translateY(0)";
                      }}
                    >
                      want to know your future
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={{ minHeight: "100vh", padding: "40px 60px", display: "flex", flexDirection: "column", alignItems: "center", boxSizing: "border-box", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Replay Link */}
        {!showIntro && (
          <a
            onClick={replayIntro}
            style={{
              position: "fixed",
              top: "20px",
              right: "20px",
              color: "#0f3b66",
              cursor: "pointer",
              fontSize: "14px",
              zIndex: 1001,
              textDecoration: "underline",
              animation: "fadeInSlow 3s ease-out",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => (e.target.style.color = "#1DA1F2")}
            onMouseOut={(e) => (e.target.style.color = "#0f3b66")}
          >
            ↻ Replay Intro
          </a>
        )}

        {/* Timeline */}
        <div style={{ width: "100%", marginBottom: 40 }}>
          <Timeline 
            trends={trends} 
            startYear={2016} 
            startMonth={4} 
            prompt={prompt} 
            onSubmit={handleTimelineSubmit} 
            onReset={handleTimelineReset}
            onRangeChange={setSelectedRange}
          />
        </div>

        {/* Context Area */}
        <div style={{ width: "100%", marginBottom: 40 }}>
          <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 200px", gap: "32px", alignItems: "start" }}>
            {/* Context Box */}
            <div style={{ padding: "24px", border: "2px solid rgba(13,48,84,0.15)", borderRadius: "12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "220px", backgroundColor: "#fafbfc" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "50%", border: "2px solid #0f3b66", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <div style={{ width: "50px", height: "60px", border: "2px solid #0f3b66", borderRadius: "4px", position: "relative" }}>
                  <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: "60%", height: "2px", backgroundColor: "#0f3b66" }} />
                  <div style={{ position: "absolute", top: "40%", left: "50%", transform: "translateX(-50%)", width: "60%", height: "2px", backgroundColor: "#0f3b66" }} />
                  <div style={{ position: "absolute", top: "60%", left: "50%", transform: "translateX(-50%)", width: "60%", height: "2px", backgroundColor: "#0f3b66" }} />
                </div>
              </div>
              <div style={{ fontSize: "14px", color: "#4a5568", fontWeight: "500", textAlign: "center" }}>Context</div>
            </div>

            {/* Title of Trend */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <h2 style={{ fontSize: "28px", fontWeight: "600", color: "#0f3b66", margin: 0 }}>
                {apiResponse?.top_trend || "Title of Trend"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {apiResponse?.message ? (
                  <p style={{ 
                    fontSize: "15px", 
                    lineHeight: "1.6", 
                    color: "#1a202c", 
                    margin: 0 
                  }}>
                    {apiResponse.message}
                  </p>
                ) : (
                  <>
                    <div style={{ height: "12px", backgroundColor: "#e2e8f0", borderRadius: "6px", width: "100%" }} />
                    <div style={{ height: "12px", backgroundColor: "#e2e8f0", borderRadius: "6px", width: "95%" }} />
                    <div style={{ height: "12px", backgroundColor: "#e2e8f0", borderRadius: "6px", width: "90%" }} />
                    <div style={{ height: "12px", backgroundColor: "#e2e8f0", borderRadius: "6px", width: "85%" }} />
                  </>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", minHeight: "220px" }}>
              <div style={{ fontSize: "20px", fontWeight: "600", color: "#0f3b66", textAlign: "right" }}>
                {selectedRange ? (
                  <>
                    {selectedRange.before.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} - {selectedRange.after.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                  </>
                ) : (
                  "All Time"
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Prompt and Enter */}
        <div style={{ width: "100%", display: "flex", alignItems: "stretch", gap: "12px" }}>
          <div style={{ flex: 1 }}>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want the model to do with the selected date range..."
              rows={4}
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "80px",
                padding: "12px 14px",
                borderRadius: "16px",
                border: "1px solid rgba(13,48,84,0.12)",
                fontSize: 15,
                boxSizing: "border-box",
                resize: "none",
                background: "#fff",
                color: "#1a202c",
                lineHeight: "1.5",
              }}
            />
            <div style={{ marginTop: 8, fontSize: 13, color: "#6b7b8f" }}>
              If you don't select a date on the timeline, all relevant trends will be accounted for.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <button
              onClick={handleEnterSubmit}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "16px",
                border: "1px solid rgba(13,48,84,0.12)",
                background: "#fff",
                cursor: "pointer",
                fontSize: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "2px",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => (e.target.style.borderColor = "rgba(13,48,84,0.2)")}
              onMouseOut={(e) => (e.target.style.borderColor = "rgba(13,48,84,0.12)")}
            >
              <span>⏎</span>
              <span style={{ fontSize: "12px", color: "#6b7b8f", fontWeight: "500" }}>enter</span>
            </button>
          </div>
        </div>

        <div style={{ width: "100%", marginTop: 12 }}>
          {loading && <div style={{ color: "#0f3b66", fontSize: 15 }}>Submitting...</div>}
          {resultMessage && (
            <div style={{ marginTop: 8, color: resultMessage.type === "error" ? "#b00020" : "#0f3b66", fontSize: 15 }}>
              {resultMessage.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;