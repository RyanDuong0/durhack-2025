from __future__ import annotations
import csv, re
from pathlib import Path
from collections import defaultdict
from datetime import datetime

IN_PATH  = Path("data") / "trends_top3_us.csv"
OUT_PATH = Path("data") / "trends_top3_us_clean.csv"
STATS_PATH = Path("data") / "trends_stats.csv"
TOPIC_SUMMARY_PATH = Path("data") / "trends_topic_summary.csv"

BAD_SUBSTRINGS = {"home", "archives", "trending topics in"}
WS_RE = re.compile(r"\s+")

def tidy_topic(t: str) -> str:
    if not t:
        return t
    t = WS_RE.sub(" ", t.strip())
    # keep hashtags/emojis/caps as-is; else title-case words that look plain
    if t.startswith("#"):
        return t
    # If the token is all-caps (e.g., NBA), keep it; else Title-Case words
    parts = []
    for word in t.split(" "):
        if len(word) > 2 and word.isupper():
            parts.append(word)
        else:
            parts.append(word.capitalize())
    return " ".join(parts)

def is_junk(t: str) -> bool:
    low = t.lower().strip()
    if not low:
        return True
    return any(bad in low for bad in BAD_SUBSTRINGS)

def iso_date_ok(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except Exception:
        return False

def load_rows(path: Path):
    with path.open("r", newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            yield row

def main():
    if not IN_PATH.exists():
        print(f"Missing input CSV: {IN_PATH}")
        return 2

    # Read, clean, and bucket by date
    by_date = defaultdict(list)
    total_in = 0
    total_out = 0

    for row in load_rows(IN_PATH):
        total_in += 1
        d = row.get("date","").strip()
        if not iso_date_ok(d):
            continue

        topic = tidy_topic(row.get("topic",""))
        if is_junk(topic):
            continue

        try:
            rank = int(row.get("rank","").strip() or 0)
        except Exception:
            rank = 0
        if rank not in (1,2,3):
            # Keep only the top-3 ranks — if your scrape ever had >3, drop extras
            continue

        by_date[d].append({
            "date": d,
            "country": row.get("country","us").strip() or "us",
            "rank": rank,
            "topic": topic,
            "popularity": row.get("popularity","") or "",
            "raw": topic,  # raw == cleaned topic (we cleaned it)
            "source": row.get("source","trend-calendar"),
        })

    # Sort each day by rank; sort days chronologically
    dates_sorted = sorted(by_date.keys())
    out_rows = []
    rows_per_day = {}

    for d in dates_sorted:
        day_rows = sorted(by_date[d], key=lambda r: r["rank"])[:3]
        rows_per_day[d] = len(day_rows)
        out_rows.extend(day_rows)

    # Write clean CSV
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["date","country","rank","topic","popularity","raw","source"])
        w.writeheader()
        for r in out_rows:
            w.writerow(r)
            total_out += 1

    # Quick stats: rows/day counts
    with STATS_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date","rows"])
        for d in dates_sorted:
            w.writerow([d, rows_per_day[d]])

    # Topic summary (frequency + first/last seen)
    # Useful for embeddings/retrieval later
    topic_days = defaultdict(list)
    for r in out_rows:
        topic_days[r["topic"]].append(r["date"])
    with TOPIC_SUMMARY_PATH.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["topic","days_seen","first_seen","last_seen"])
        for t, ds in sorted(topic_days.items(), key=lambda kv: (-len(kv[1]), kv[0].lower())):
            ds_sorted = sorted(ds)
            w.writerow([t, len(set(ds_sorted)), ds_sorted[0], ds_sorted[-1]])

    print(f"Cleaned {total_out} / {total_in} into {OUT_PATH}")
    print(f"Per-day counts → {STATS_PATH}")
    print(f"Per-topic summary → {TOPIC_SUMMARY_PATH}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
