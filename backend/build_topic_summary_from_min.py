# build_topic_summary_from_min.py
from __future__ import annotations
import csv, json
from pathlib import Path
from collections import defaultdict

IN = Path("data") / "trends_min_us.csv"
OUT = Path("data") / "trends_topic_summary.json"

def main():
    if not IN.exists():
        print(f"Missing {IN}")
        return 2

    topic_dates = defaultdict(list)
    with IN.open("r", encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            d = row["date"].strip()
            t = row["topic"].strip()
            if d and t:
                topic_dates[t].append(d)

    summary = []
    for topic, dates in topic_dates.items():
        ds = sorted(set(dates))
        summary.append({
            "topic": topic,
            "first_seen": ds[0],
            "last_seen": ds[-1],
            "days_seen": len(ds),
            "years_active": sorted({d[:4] for d in ds}),
            "example_dates": ds[:3],
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"✅ Wrote {OUT} ({len(summary)} unique topics)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
