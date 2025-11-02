# app.py
from __future__ import annotations
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np

from retriever import TrendRetriever
from llm_client import embed_texts, chat

app = FastAPI(title="teatime.ai")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

R = TrendRetriever()

@app.get("/ping")
def ping():
    return {"ok": True, "topics": len(R.topic_dates), "has_embeddings": R.emb is not None, "csv_bounds": {"start": R.csv_start, "end": R.csv_end}}

class BrewReq(BaseModel):
    question: str
    mode: str = "wacky"     # "wacky" | "sensible" | "oracle"
    start: Optional[str] = None
    end: Optional[str] = None
    k: int = 8

class SearchReq(BaseModel):
    query: str
    start: Optional[str] = None
    end: Optional[str] = None
    k: int = 10

SYSTEM_TONE = """You are teatime.ai: a mischievous but reliable tea-leaf oracle.
STYLE:
- Open with one whimsical line (e.g., “🫖 The leaves swirl…”).
- Then answer clearly in 2–4 sentences with playful metaphors.
- Use ONLY the provided “ingredients” (Twitter trends from CSV in the given window) for grounding.
- If ingredients are weak, say so briefly before a cautious guess.
- Add 3–6 bullet “ingredients” you used, then: “Confidence: Low/Medium/High — for fun, not facts.”
CONSTRAINTS: Do not invent facts beyond ingredients. No tables. Keep it concise.
"""

def _embed_query(q: str) -> Optional[np.ndarray]:
    try:
        e = embed_texts([q])[0]
        return np.array(e, dtype=np.float32)
    except Exception:
        return None

def _pick_ingredients(question: str, start: str, end: str, k: int) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    q_emb = _embed_query(question)
    if q_emb is not None:
        items = R.dense_search(q_emb, k=k, start=start, end=end)
    if not items:
        items = R.keyword_search(question, k=k, start=start, end=end)
    out = []
    for it in items:
        tl = R.topic_timeline(it["topic"])
        out.append({
            "topic": it["topic"],
            "score": round(float(it["score"]), 4),
            "first_seen": tl["first_seen"],
            "last_seen": tl["last_seen"],
            "days_seen": tl["days_seen"],
        })
    return out

def _build_user_prompt(q: str, ingredients: List[Dict[str, Any]], mode: str, window: dict) -> str:
    tone_note = {
        "wacky": "Crank up the whimsy but stay faithful to the ingredients.",
        "sensible": "Tone down the whimsy; focus on clarity.",
        "oracle": "Mystical phrasing ok, still grounded."
    }.get(mode, "Keep it playful but grounded.")
    lines = [
        f"Question: {q}",
        f"Date window: {window['start']} → {window['end']}",
        "Ingredients (CSV-derived trends):" if ingredients else "Ingredients: (none)",
    ]
    for ing in ingredients[:6]:
        lines.append(f"- {ing['topic']} ({ing['first_seen']}→{ing['last_seen']}, {ing['days_seen']} days)")
    lines.append(f"Tone: {mode}. {tone_note}")
    lines.append("Produce one prophecy per STYLE/CONSTRAINTS.")
    return "\n".join(lines)

@app.post("/search")
def search(req: SearchReq):
    s, e = R.clamp_window(req.start, req.end)
    ings = _pick_ingredients(req.query, s, e, req.k)
    return {"start": s, "end": e, "results": ings}

@app.post("/brew")
def brew(req: BrewReq):
    s, e = R.clamp_window(req.start, req.end)
    ings = _pick_ingredients(req.question, s, e, req.k)
    user_prompt = _build_user_prompt(req.question, ings, req.mode, {"start": s, "end": e})
    try:
        prophecy = chat(SYSTEM_TONE, user_prompt, max_tokens=320)
        steep = "High" if len(ings) >= 6 else ("Medium" if len(ings) >= 3 else "Low")
    except Exception as ex:
        prophecy = f"🫖 The Leaves Cough\nI’m out of steam: {ex}"
        steep = "Low"
    return {"prophecy": prophecy, "steep_level": steep, "ingredients": ings, "mode": req.mode, "window": {"start": s, "end": e}}
