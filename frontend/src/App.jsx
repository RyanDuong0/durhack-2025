import { useState, useEffect } from "react";

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

// Timeline data structure for each 3-month period
const timelineData = [
  {
    id: 1,
    period: "Jan - Mar '24",
    date: new Date(2024, 0, 1),
    title: "TikTok Ban Speculation",
    description: "Congressional hearings intensified discussions about potential TikTok restrictions in the United States.",
    image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&h=300&fit=crop"
  },
  {
    id: 2,
    period: "Apr - Jun '24",
    date: new Date(2024, 3, 1),
    title: "April '24 TikTok Ban",
    description: "Legislation passed requiring ByteDance to divest TikTok or face a ban in the US market.",
    image: "https://images.unsplash.com/photo-1616509091215-57bbece93654?w=400&h=300&fit=crop"
  },
  {
    id: 3,
    period: "Jul - Sep '24",
    date: new Date(2024, 6, 1),
    title: "Election Tensions Rise",
    description: "Social media platforms became battlegrounds for political discourse and misinformation concerns.",
    image: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=400&h=300&fit=crop"
  },
  {
    id: 4,
    period: "Oct - Dec '24",
    date: new Date(2024, 9, 1),
    title: "AI Content Explosion",
    description: "Generative AI tools transformed content creation, sparking debates about authenticity and creativity.",
    image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop"
  },
  {
    id: 5,
    period: "Jan - Mar '25",
    date: new Date(2025, 0, 1),
    title: "Platform Regulation",
    description: "New digital safety laws reshaped how social media companies moderate content globally.",
    image: "https://images.unsplash.com/photo-1551817958-20c7a7cc21e3?w=400&h=300&fit=crop"
  },
  {
    id: 6,
    period: "Apr - Jun '25",
    date: new Date(2025, 3, 1),
    title: "Creator Economy Boom",
    description: "Monetization features expanded as platforms competed for top content creators.",
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=300&fit=crop"
  },
  {
    id: 7,
    period: "Jul - Sep '25",
    date: new Date(2025, 6, 1),
    title: "July '25 Incident",
    description: "A significant security event raised concerns about platform safety and user data protection.",
    image: "https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=400&h=300&fit=crop"
  },
  {
    id: 8,
    period: "Oct - Dec '25",
    date: new Date(2025, 9, 1),
    title: "Web3 Integration",
    description: "Decentralized social features began appearing on mainstream platforms.",
    image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=300&fit=crop"
  }
];

// Timeline Component (recreated from original code structure)
function Timeline({ trends, startYear, startMonth, prompt, onSubmit, onReset }) {
  const [selectedRange, setSelectedRange] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);

  const startDate = new Date(startYear, startMonth - 1, 1);
  const now = new Date();
  const totalMonths = (now.getFullYear() - startYear) * 12 + (now.getMonth() - (startMonth - 1)) + 1;
  const totalBars = Math.ceil(totalMonths / 3); // Each bar represents 3 months

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
    setSelectedRange({ start: index, end: index });
  };

  const handleMouseEnter = (index) => {
    setHoverIndex(index);
    if (isSelecting && selectionStart !== null) {
      const start = Math.min(selectionStart, index);
      const end = Math.max(selectionStart, index);
      setSelectedRange({ start, end });
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
  };

  const handleSubmitClick = () => {
    if (selectedRange && onSubmit) {
      const startBar = bars[selectedRange.start];
      const endBar = bars[selectedRange.end];
      const before = startBar.date;
      const after = endBar.endDate;
      onSubmit({ before, after }, prompt);
    } else if (onSubmit) {
      onSubmit(null, prompt);
    }
  };

  const handleResetClick = () => {
    setSelectedRange(null);
    setSelectionStart(null);
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7b8f", marginTop: 6 }}>
          <span>{startYear}</span>
          <span>today</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <button
          onClick={handleSubmitClick}
          style={{
            padding: "10px 20px",
            backgroundColor: "#0f3b66",
            color: "white",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 500,
            transition: "background-color 0.2s ease",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#1a5490")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#0f3b66")}
        >
          Submit
        </button>
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
            fontSize: 13,
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

  // Intro sequence
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
        // Step 10 now shows the description and button, no auto-transition
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
    setLoading(true);

    console.log("User prompt:", promptText);
    setResultMessage({
      type: "info",
      text: `Prompt submitted: ${promptText || "(empty)"}`,
      range: range ? { from: range.before.toLocaleString(), to: range.after.toLocaleString() } : null,
    });

    setLoading(false);
  };

  const handleTimelineReset = () => {
    setResultMessage(null);
    setLoading(false);
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

      {/* Fixed Title - Only visible after intro */}
      {!showIntro && (
        <h1
          style={{
            position: "fixed",
            top: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: "3.6rem",
            fontWeight: "700",
            margin: 0,
            zIndex: 10000,
            pointerEvents: "none",
          }}
        >
          our Legacy
        </h1>
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
              {/* our Legacy ? */}
              {introStep >= 1 && introStep < 2 && (
                <h1
                  style={{
                    fontSize: "3.6rem",
                    margin: 0,
                    animation: "fadeInUp 1.2s ease-out",
                  }}
                >
                  our Legacy
                </h1>
              )}

              {/* who decides it */}
              {introStep >= 2 && introStep < 3 && (
                <p
                  style={{
                    fontSize: "2.16rem",
                    margin: 0,
                    animation: "fadeIn 1.2s ease-out",
                  }}
                >
                  who decides it ?
                </p>
              )}

              {/* X logo */}
              {introStep >= 3 && introStep < 5 && (
                <div
                  style={{
                    fontSize: "4.8rem",
                    fontWeight: "bold",
                    position: "relative",
                    display: "inline-block",
                    animation: "fadeIn 1.2s ease-out",
                  }}
                >
                  <span style={{ position: "relative", display: "inline-block" }}>
                    𝕏
                    {introStep >= 4 && (
                      <span
                        style={{
                          position: "absolute",
                          top: "50%",
                          left: 0,
                          height: "4px",
                          backgroundColor: "black",
                          transform: "translateY(-50%)",
                          animation: "strikethroughGrow 0.8s ease-out forwards",
                        }}
                      />
                    )}
                  </span>
                </div>
              )}

              {/* Twitter */}
              {introStep >= 5 && introStep < 7 && (
                <p
                  style={{
                    fontSize: "3.6rem",
                    margin: 0,
                    fontWeight: "600",
                    color: "#1DA1F2",
                    animation: "fadeIn 1.2s ease-out",
                  }}
                >
                  Twitter
                </p>
              )}

              {/* History repeats itself */}
              {introStep >= 7 && introStep < 8 && (
                <p
                  style={{
                    fontSize: "2.16rem",
                    margin: 0,
                    animation: "fadeIn 1.2s ease-out",
                  }}
                >
                  History repeats itself
                </p>
              )}

              {/* and we tell it... */}
              {introStep >= 8 && introStep < 9 && (
                <p
                  style={{
                    fontSize: "2.16rem",
                    margin: 0,
                    animation: "fadeIn 1.2s ease-out",
                  }}
                >
                  and we tell it...
                </p>
              )}

              {/* our Legacy with transition */}
              {introStep >= 9 && (
                <h1
                  style={{
                    fontSize: "3.6rem",
                    margin: 0,
                    fontWeight: "700",
                    animation: "fadeIn 1.2s ease-out",
                    position: teaTimeTransitioning ? "fixed" : "static",
                    top: teaTimeTransitioning ? "40px" : "auto",
                    left: teaTimeTransitioning ? "50%" : "auto",
                    transform: teaTimeTransitioning ? "translateX(-50%)" : "none",
                    transition: "all 1.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    zIndex: 10000,
                  }}
                >
                  our Legacy
                </h1>
              )}
            </div>

            {/* Description and Stats - Only visible during intro */}
            {introStep >= 10 && (
              <div style={{ marginTop: "60px", animation: "fadeIn 1s ease-out" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", maxWidth: "1000px" }}>
                  <div style={{ fontSize: "14px", color: "#6b7b8f", lineHeight: "1.6", textAlign: "left" }}>
                    <p style={{ margin: "0 0 12px 0" }}>
                      Ask and you shall receive, we'll predict what's in store for you using only relevant trending Twitter topics.
                    </p>
                    <p style={{ margin: "0 0 12px 0" }}>
                      Is there a timeline you're biased towards? Date back to the era, choosing a period on the timeline, and we'll keep just what's relevant to you.
                    </p>
                    <p style={{ margin: 0 }}>
                      Leave it blank to keep everything included.
                    </p>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "20px", textAlign: "left" }}>
                    <div>
                      <div style={{ fontSize: "13px", color: "#6b7b8f", marginBottom: "4px" }}>Aug '25</div>
                      <div style={{ fontSize: "42px", fontWeight: "700" }}>67</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "#6b7b8f", marginBottom: "4px" }}>April '24</div>
                      <div style={{ fontSize: "20px", fontWeight: "600" }}>TikTok ban</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", color: "#6b7b8f", marginBottom: "4px" }}>July '25</div>
                      <div style={{ fontSize: "20px", fontWeight: "600" }}>💀 attempt</div>
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
      <div
        style={{
          minHeight: "100vh",
          padding: "120px 60px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
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
              zIndex: 1000,
              textDecoration: "underline",
              animation: "fadeInSlow 3s ease-out",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => {
              e.target.style.color = "#1DA1F2";
            }}
            onMouseOut={(e) => {
              e.target.style.color = "#0f3b66";
            }}
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
          />
        </div>

        {/* Gap for Context/Content */}
        <div style={{ width: "100%", minHeight: "250px", marginBottom: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            padding: "40px",
            border: "2px dashed rgba(13,48,84,0.15)",
            borderRadius: "12px",
            color: "#6b7b8f",
            fontSize: "14px",
            textAlign: "center"
          }}>
            Context / Content area - will be populated based on timeline selection
          </div>
        </div>

        {/* Prompt and Enter */}
        <div style={{ width: "100%", display: "flex", alignItems: "flex-end", gap: "12px" }}>
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
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(13,48,84,0.08)",
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
                background: "#fff",
              }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "#6b7b8f" }}>
              If you don't select a date on the timeline, all relevant trends will be accounted for.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px" }}>
            <button
              style={{
                width: "50px",
                height: "50px",
                borderRadius: "8px",
                border: "1px solid rgba(13,48,84,0.12)",
                background: "#fff",
                cursor: "pointer",
                fontSize: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s ease",
              }}
              onMouseOver={(e) => {
                e.target.style.background = "#f7f9fa";
                e.target.style.borderColor = "rgba(13,48,84,0.2)";
              }}
              onMouseOut={(e) => {
                e.target.style.background = "#fff";
                e.target.style.borderColor = "rgba(13,48,84,0.12)";
              }}
            >
              ⏎
            </button>
            <span style={{ fontSize: "11px", color: "#6b7b8f", marginTop: "4px" }}>enter</span>
          </div>
        </div>

        <div style={{ width: "100%", marginTop: 12 }}>
          {loading && <div style={{ color: "#0f3b66" }}>Submitting...</div>}
          {resultMessage && (
            <div style={{ marginTop: 8, color: resultMessage.type === "error" ? "#b00020" : "#155e75" }}>
              {resultMessage.text}
              {resultMessage.range && (
                <div style={{ marginTop: 6, fontSize: 13, color: "#0f3b66" }}>
                  Range used: {resultMessage.range.from} — {resultMessage.range.to}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;