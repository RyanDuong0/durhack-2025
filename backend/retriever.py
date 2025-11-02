# retriever.py
from __future__ import annotations
import json, csv
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np

DATA_DIR = Path("data")
TRENDS_MIN = DATA_DIR / "trends_min_us.csv"
EMB_PATH = DATA_DIR / "topic_embeddings.npy"
IDX_PATH = DATA_DIR / "topic_index.json"

def _load_trend_rows() -> List[Dict[str, str]]:
    rows = []
    with TRENDS_MIN.open("r", encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        for r in rdr:
            rows.append({"date": r["date"], "rank": r["rank"], "topic": r["topic"]})
    return rows

def _load_index_and_embs() -> Tuple[Optional[np.ndarray], Optional[list[dict]]]:
    if EMB_PATH.exists() and IDX_PATH.exists():
        E = np.load(EMB_PATH)
        idx = json.loads(IDX_PATH.read_text(encoding="utf-8"))
        return E, idx
    return None, None

def _csv_bounds(rows) -> tuple[str, str]:
    dates = sorted({r["date"] for r in rows})
    return dates[0], dates[-1]

class TrendRetriever:
    def __init__(self):
        self.rows = _load_trend_rows()
        self.csv_start, self.csv_end = _csv_bounds(self.rows)
        self.emb, self.index = _load_index_and_embs()

        self.topic_dates: Dict[str, list[str]] = {}
        for r in self.rows:
            self.topic_dates.setdefault(r["topic"], []).append(r["date"])
        for t in self.topic_dates:
            self.topic_dates[t] = sorted(set(self.topic_dates[t]))

    def clamp_window(self, start: Optional[str], end: Optional[str]) -> tuple[str, str]:
        s = start or self.csv_start
        e = end or self.csv_end
        return max(s, self.csv_start), min(e, self.csv_end)

    @staticmethod
    def _cosine(a: np.ndarray, B: np.ndarray) -> np.ndarray:
        a = a / (np.linalg.norm(a) + 1e-8)
        Bn = B / (np.linalg.norm(B, axis=1, keepdims=True) + 1e-8)
        return Bn @ a

    def _filter_by_window(self, topics: List[str], start: Optional[str], end: Optional[str]) -> List[str]:
        if not start and not end:
            return topics
        s = start or "0000-01-01"
        e = end or "9999-12-31"
        out = []
        for t in topics:
            ds = self.topic_dates.get(t, [])
            if any(s <= d <= e for d in ds):
                out.append(t)
        return out

    def dense_search(self, q_emb: np.ndarray, k: int = 8, start: Optional[str]=None, end: Optional[str]=None) -> List[Dict[str, Any]]:
        if self.emb is None or self.index is None:
            return []
        scores = self._cosine(q_emb.astype(np.float32), self.emb.astype(np.float32))
        order = np.argsort(-scores)
        prelim = [{"topic": self.index[int(i)]["topic"], "score": float(scores[int(i)])} for i in order[:64]]
        allowed = set(self._filter_by_window([p["topic"] for p in prelim], start, end))
        winners = [p for p in prelim if p["topic"] in allowed][:k]
        return winners

    def keyword_search(self, query: str, k: int = 8, start: Optional[str]=None, end: Optional[str]=None) -> List[Dict[str, Any]]:
        q = query.lower().split()
        candidates: Dict[str, int] = {}
        for r in self.rows:
            t = r["topic"]; tl = t.lower()
            if any(tok in tl for tok in q) or (tl.startswith("#") and any(tok in tl[1:] for tok in q)):
                candidates[t] = max(candidates.get(t, 0), 1)
        allowed = set(self._filter_by_window(list(candidates.keys()), start, end))
        items = [{"topic": t, "score": float(candidates[t])} for t in candidates if t in allowed]
        items.sort(lambda x: (-x["score"], x["topic"]))
        return items[:k]

    def topic_timeline(self, topic: str) -> Dict[str, Any]:
        dates = self.topic_dates.get(topic, [])
        if not dates:
            return {"topic": topic, "first_seen": None, "last_seen": None, "days_seen": 0, "dates": []}
        return {"topic": topic, "first_seen": dates[0], "last_seen": dates[-1], "days_seen": len(dates), "dates": dates}
