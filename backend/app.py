# app.py
from __future__ import annotations

"""
teatime.ai — FastAPI backend
Vibe: wacky ChatGPT with Twitter/X brainrot, zero mystic/oracle language.
ASCII-only output to avoid PowerShell mojibake.
API:
- GET  /ping
- POST /search  -> { start, end, results: [ {topic, score, first_seen, last_seen, days_seen} ] }
- POST /brew    -> { prophecy, steep_level, ingredients, mode, window: {start, end} }
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import numpy as np
import re
import unicodedata

from retriever import TrendRetriever
from llm_client import embed_texts, chat


# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------

app = FastAPI(title="teatime.ai")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

R = TrendRetriever()


# -----------------------------------------------------------------------------
# Request models
# -----------------------------------------------------------------------------

class BrewReq(BaseModel):
    question: str
    mode: str = "wacky"        # "wacky" | "sensible" | "oracle"
    start: Optional[str] = None
    end: Optional[str] = None
    k: int = 8                 # number of trend ingredients to fetch

class SearchReq(BaseModel):
    query: str
    start: Optional[str] = None
    end: Optional[str] = None
    k: int = 10                # number of search results


# -----------------------------------------------------------------------------
# System prompt (tone) — strictly no mystic language, ASCII only
# -----------------------------------------------------------------------------

SYSTEM_TONE = """You are Teatime.ai: a slightly feral, trend-soaked chat buddy with Twitter/X brainrot energy — but still helpful and safe.

HARD RULES (IMPORTANT)
- ASCII ONLY. No emojis, no fancy quotes, no special symbols.
- NO mystical, occult, or prophecy language. Avoid words like: oracle, prophecy, leaves, whisper, destiny, fate, foretold, spirit, ritual.
- Ground ONLY in the provided "ingredients" (Twitter/X trends from CSV within the supplied window).
- Do not invent facts beyond ingredients.

STYLE
- Open with a short hype line like: "Hot take from the timeline:" or "Trending brain says:" (ASCII only).
- Then answer in 2–5 clear, punchy sentences. Witty and memey is fine, readable first.
- If ingredients are weak, say that first, then make a cautious, vibes-only guess.
- Finish with this exact section (ASCII only):
  Trending bits I used:
  - <topic> — <first_seen> to <last_seen> (<N> days)
  - ...
  Confidence: Low/Medium/High — vibes-only, not facts.

LENGTH
- Keep total output around 120–180 words.
"""


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _embed_query(q: str) -> Optional[np.ndarray]:
    """Return a float32 embedding for q or None on failure."""
    try:
        e = embed_texts([q])[0]
        return np.array(e, dtype=np.float32)
    except Exception:
        return None


def _pick_ingredients(question: str, start: Optional[str], end: Optional[str], k: int) -> List[Dict[str, Any]]:
    """
    Pull the top-k trend 'ingredients' using dense search; fall back to keyword.
    Returns simplified dicts for the LLM and UI.
    """
    items: List[Dict[str, Any]] = []
    q_emb = _embed_query(question)
    if q_emb is not None:
        items = R.dense_search(q_emb, k=k, start=start, end=end)
    if not items:
        items = R.keyword_search(question, k=k, start=start, end=end)

    out: List[Dict[str, Any]] = []
    for it in items:
        tl = R.topic_timeline(it["topic"])
        out.append({
            "topic": it["topic"],
            "score": round(float(it.get("score", 0.0)), 4),
            "first_seen": tl["first_seen"],
            "last_seen": tl["last_seen"],
            "days_seen": tl["days_seen"],
        })
    return out


def _build_user_prompt(q: str, ingredients: List[Dict[str, Any]], mode: str, window: Dict[str, str]) -> str:
    """
    Construct the user message with a strict ASCII template and mode guidance.
    """
    tone_note = {
        "wacky": "High energy, memey, but clear. No mystical language.",
        "sensible": "Straightforward and helpful with a light wink. No slang overload.",
        "oracle": "Dramatic cadence is fine, but absolutely no mystical or prophetic wording.",
    }.get(mode, "Keep it playful but grounded. No mystical language.")

    max_bullets = max(3, min(6, len(ingredients)))
    lines: List[str] = [
        f"Question: {q}",
        f"Date window: {window['start']} -> {window['end']}",
        "Ingredients (CSV-derived trends):" if ingredients else "Ingredients: (none; trends were weak or unavailable)",
    ]
    for ing in ingredients[:max_bullets]:
        lines.append(f"- {ing['topic']} ({ing['first_seen']}->{ing['last_seen']}, {ing['days_seen']} days)")

    # Strict output contract (ASCII only)
    lines.append("")
    lines.append("Tone guide: " + tone_note)
    lines.append("OUTPUT FORMAT (exactly this, ASCII only):")
    lines.append("Hot take from the timeline:")
    lines.append("<2-5 sentences of answer. No mystical words. No emojis. ASCII only.>")
    lines.append("Trending bits I used:")
    lines.append("- <topic> — <first_seen> to <last_seen> (<N> days)")  # the model will substitute real bullets
    lines.append("Confidence: Low/Medium/High — vibes-only, not facts.")
    lines.append("")
    lines.append("Produce one answer following OUTPUT FORMAT. Do not add extra sections.")
    return "\n".join(lines)


def _steep_from_ingredients(n: int) -> str:
    """High if >=6, Medium if >=3, else Low."""
    return "High" if n >= 6 else ("Medium" if n >= 3 else "Low")


_ascii_dash_re = re.compile(r"[–—]+")  # normalize long dashes to single hyphen
_multi_blank_re = re.compile(r"\n{3,}")


def _sanitize_ascii(text: str) -> str:
    """
    Normalize to ASCII for Windows terminals:
    - NFKD normalize
    - replace en/em dashes with '-'
    - strip all non-ASCII
    - collapse absurd blank lines
    """
    if not isinstance(text, str):
        return ""
    t = unicodedata.normalize("NFKD", text)
    t = _ascii_dash_re.sub("-", t)
    # strip non-ascii bytes
    t = t.encode("ascii", "ignore").decode("ascii")
    # tidy spaces
    t = _multi_blank_re.sub("\n\n", t)
    return t.strip()


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.get("/ping")
def ping():
    """Health check + corpus metadata."""
    return {
        "ok": True,
        "topics": len(R.topic_dates),
        "has_embeddings": R.emb is not None,
        "csv_bounds": {"start": R.csv_start, "end": R.csv_end},
        "modes": ["wacky", "sensible", "oracle"],
        "encoding": "ASCII-only response text",
    }


@app.post("/search")
def search(req: SearchReq):
    """Search for relevant trends to a query within an optional time window."""
    s, e = R.clamp_window(req.start, req.end)
    k = max(1, min(int(req.k or 10), 50))  # simple guardrail
    ings = _pick_ingredients(req.query, s, e, k)
    return {"start": s, "end": e, "results": ings}


@app.post("/brew")
def brew(req: BrewReq):
    """
    Generate a timeline-fueled hot take, grounded in trends ("ingredients").
    Returns ASCII-only text as `prophecy` for frontend compatibility.
    """
    s, e = R.clamp_window(req.start, req.end)
    k = max(1, min(int(req.k or 8), 50))
    ings = _pick_ingredients(req.question, s, e, k)
    user_prompt = _build_user_prompt(req.question, ings, req.mode, {"start": s, "end": e})

    try:
        # Slightly higher cap to allow bullets; adjust if needed by frontend
        raw = chat(SYSTEM_TONE, user_prompt, max_tokens=360)
        prophecy = _sanitize_ascii(raw)
        steep = _steep_from_ingredients(len(ings))
    except Exception as ex:
        prophecy = _sanitize_ascii(f"Brain lag. Could not brew a take: {ex}")
        steep = "Low"

    return {
        "prophecy": prophecy,              # ASCII-safe text
        "steep_level": steep,              # High/Medium/Low from ingredient count
        "ingredients": ings,               # surfaced to UI
        "mode": req.mode,
        "window": {"start": s, "end": e},
    }
