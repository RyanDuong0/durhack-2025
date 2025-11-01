import { useState } from "react";
import Timeline from "./components/Timeline.jsx";
import { trends } from "./data/exampleTrends.js";

function App() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);

  // Called by Timeline when user clicks Submit
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

  // Called by Timeline when user resets selection
  const handleTimelineReset = () => {
    // Clear any submitted result the parent is showing
    setResultMessage(null);
    setLoading(false);
    console.log("Timeline selection reset — parent cleared displayed prompt/range.");
  };

  return (
    <>
      <div
        style={{
          minHeight: "100vh",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center", // centers vertically as well
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ marginBottom: 12 }}>Tea Timeline</h1>

        <div style={{ width: "100%", maxWidth: 1100, marginBottom: 12 }}>
          <label htmlFor="prompt" style={{ display: "block", marginBottom: 6, color: "#35536d", fontSize: 13 }}>
            Enter prompt for the ML model
          </label>
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
            If you don't select a date on the timeline, submitting will use the whole timeline range.
          </div>
        </div>

        {/* Pass startYear=2016 and startMonth=3 (April) explicitly so App cannot accidentally override it */}
        <Timeline
          trends={trends}
          startYear={2016}
          startMonth={3}
          prompt={prompt}
          onSubmit={handleTimelineSubmit}
          onReset={handleTimelineReset}
        />

        <div style={{ width: "100%", maxWidth: 1100, marginTop: 12 }}>
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
    </>
  );
}

export default App;