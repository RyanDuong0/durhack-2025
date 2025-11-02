# clean_trends_csv.py
from __future__ import annotations
import csv, re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

IN_PATH  = Path("data") / "trends_top3_us.csv"
OUT_PATH = Path("data") / "trends_top3_us_clean.csv"
MIN_PATH = Path("data") / "trends_min_us.csv"

BAD_SUBSTRINGS = {"home", "archives", "trending topics in"}
WS_RE = re.compile(r"\s+")

def tidy_topic(t: str) -> str:
    if not t:
        return t
    t = WS_RE.sub(" ", t.strip())
    if t.startswith("#"):
        return t  # keep hashtags as-is
    parts = []
    for w in t.split(" "):
        if len(w) > 2 and w.isupper():
            parts.append(w)
        else:
            parts.append(w.capitalize())
    return " ".join(parts)

def is_junk(t: str) -> bool:
    low = (t or "").lower().strip()
    if not low: return True
    return any(bad in low for bad in BAD_SUBSTRINGS)

def iso_ok(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d"); return True
    except: return False

def main():
    if not IN_PATH.exists():
        print(f"Missing input {IN_PATH}"); return 2

    rows = []
    with IN_PATH.open("r", encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        for r in rdr:
            d = (r.get("date") or "").strip()
            if not iso_ok(d): continue
            try:
                rank = int((r.get("rank") or "").strip())
            except: rank = 0
            if rank not in (1,2,3): continue

            topic = tidy_topic(r.get("topic",""))
            if is_junk(topic): continue

            rows.append({
                "date": d,
                "country": (r.get("country") or "us").strip(),
                "rank": rank,
                "topic": topic,
                "popularity": "",        # not reliable from site
                "raw": topic,            # keep same as topic (no dup noise)
                "source": "trend-calendar"
            })

    rows.sort(key=lambda x: (x["date"], x["rank"]))

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date","country","rank","topic","popularity","raw","source"])
        w.writeheader(); w.writerows(rows)

    # Minimal CSV for app: date,rank,topic
    with MIN_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date","rank","topic"])
        w.writeheader()
        for r in rows:
            w.writerow({"date": r["date"], "rank": r["rank"], "topic": r["topic"]})

    print(f"Clean rows: {len(rows)}")
    print(f"→ {OUT_PATH}")
    print(f"→ {MIN_PATH}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
