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

    // Example payload - adjust to your backend shape
    const payload = {
      prompt: promptText,
      range: {
        from: range.before.toISOString(),
        to: range.after.toISOString(),
      },
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server responded ${res.status}: ${text}`);
      }

      const data = await res.json();
      setResultMessage({ type: "success", text: "Submitted successfully.", data });
    } catch (err) {
      console.error("Submit error:", err);
      setResultMessage({ type: "error", text: err.message || "Submit failed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ minHeight: "100vh", padding: "20px" }}>
        <h1 style={{ marginBottom: 12 }}>Tea Time (Twitter Trending)</h1>

        <div style={{ marginBottom: 12, maxWidth: 1100 }}>
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

        {/* Pass prompt and onSubmit handler down to Timeline */}
        <Timeline trends={trends} startYear={2015} prompt={prompt} onSubmit={handleTimelineSubmit} />

        <div style={{ maxWidth: 1100, marginTop: 12 }}>
          {loading && <div style={{ color: "#0f3b66" }}>Submitting...</div>}
          {resultMessage && (
            <div style={{ marginTop: 8, color: resultMessage.type === "error" ? "#b00020" : "#155e75" }}>
              {resultMessage.text}
              {resultMessage.data && (
                <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(resultMessage.data, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default App;