from pathlib import Path
import csv

IN = Path("data") / "trends_top3_us.csv"
OUT = Path("data") / "trends_min_us.csv"

with IN.open("r", encoding="utf-8", newline="") as f_in, OUT.open("w", encoding="utf-8", newline="") as f_out:
    r = csv.DictReader(f_in)
    w = csv.DictWriter(f_out, fieldnames=["date","rank","topic"])
    w.writeheader()
    for row in r:
        w.writerow({
            "date": row["date"],
            "rank": row["rank"],
            "topic": row["topic"]
        })

print(f"✅ Wrote {OUT}")
