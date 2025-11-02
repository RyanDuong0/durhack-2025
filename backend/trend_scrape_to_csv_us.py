# trend_scrape_to_csv_us.py
from __future__ import annotations
import csv, time, re, sys
from pathlib import Path
from datetime import date, datetime, timedelta, UTC
from typing import List, Dict, Any, Optional
import requests
from bs4 import BeautifulSoup

USER_AGENT = "teatime.ai-hackathon-bot/1.0 (+contact: you@example.com)"
SLEEP_SEC = 1.0
TIMEOUT = 20

COUNTRY = "us"
BASE_FMT = "https://us.trend-calendar.com/trend/{iso}.html"
ROBOTS_URL = "https://us.trend-calendar.com/robots.txt"

OUT_PATH = Path("data") / "trends_top3_us.csv"

# ---------------- parsing helpers ----------------
_score_re = re.compile(r"(\d[\d,\.]*)(?:\s*[kKmM])?")

def _parse_popularity(text: str) -> Optional[float]:
    text = text.replace(",", "")
    m = _score_re.search(text)
    if not m:
        return None
    try:
        val = float(m.group(1))
        if "k" in text.lower(): val *= 1_000
        if "m" in text.lower(): val *= 1_000_000
        return val
    except Exception:
        return None

def _extract_topic(raw_text: str) -> str:
    return raw_text.strip()

BAD_SUBSTRINGS = ["trending topics in", "archives", "home"]

def is_bad_topic(t: str) -> bool:
    low = t.lower()
    return any(s in low for s in BAD_SUBSTRINGS) or not t.strip()

def choose_best_list(container: BeautifulSoup):
    """
    Among all <ol>/<ul> inside the main content, pick the one that
    looks like the daily Twitter list: short items, not sidebar.
    """
    lists = container.find_all(["ol", "ul"])
    best = None
    best_score = -1
    for lst in lists:
        lis = lst.find_all("li", recursive=True)
        if len(lis) < 3:
            continue
        texts = [(li.find("a").get_text(" ", strip=True) if li.find("a") else li.get_text(" ", strip=True)) for li in lis[:5]]
        bad_hits = sum(1 for t in texts if is_bad_topic(t))
        avg_len = sum(len(t) for t in texts) / max(1, len(texts))
        # Heuristic: prefer lists with few "bad" hits and not super-long items
        score = (len(lis) >= 3) * 10 - bad_hits * 5 - (avg_len > 70) * 3
        if score > best_score:
            best_score, best = score, lst
    return best

def fetch_day(d: date) -> List[Dict[str, Any]]:
    url = BASE_FMT.format(iso=d.isoformat())
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
    }
    r = requests.get(url, headers=headers, timeout=TIMEOUT)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    r.encoding = "utf-8"
    soup = BeautifulSoup(r.text, "html.parser")

    # 1) Limit to article body (center column)
    content = (
            soup.select_one("article .entry-content")
            or soup.select_one("div.entry-content")
            or soup.select_one("main article .entry-content")
            or soup.select_one("main article")
            or soup.select_one("article")
            or soup.select_one("#content")
            or soup
    )

    # 2) Find the heading that says "X (Twitter) Trending Topics ..."
    heading = None
    for h in content.find_all(["h1", "h2", "h3"]):
        txt = h.get_text(" ", strip=True).lower()
        if "trending topics" in txt and ("twitter" in txt or "x (" in txt):
            heading = h
            break
    if not heading:
        # fallback: try first heading in article
        heading = content.find(["h2", "h3"]) or content.find("h1")

    # 3) Walk forward until next heading; collect anchors or numbered lines
    topics: list[str] = []
    numbered_line = re.compile(r"^\s*\d+\.\s*(.+?)\s*$")
    sib = heading
    while sib is not None:
        sib = sib.find_next_sibling()
        if sib is None:
            break
        if getattr(sib, "name", "").lower() in ("h1", "h2", "h3"):
            break  # stop at next section

        # pull <a> texts first
        for a in sib.find_all("a"):
            t = a.get_text(" ", strip=True)
            if not t:
                continue
            low = t.lower()
            if "trending topics in" in low or "archives" in low or low == "home":
                continue
            topics.append(t)

        # also scan raw text for "1. Thing" lines
        text_block = sib.get_text("\n", strip=True)
        for line in text_block.splitlines():
            m = numbered_line.match(line)
            if m:
                t = m.group(1).strip()
                low = t.lower()
                if not t or "trending topics in" in low or "archives" in low or low == "home":
                    continue
                topics.append(t)

        # stop early once we clearly picked up list items
        if len(topics) >= 3:
            break

    # de-dup while preserving order
    seen = set()
    clean = []
    for t in topics:
        if t not in seen:
            seen.add(t)
            clean.append(t)
        if len(clean) == 3:
            break

    items: list[Dict[str, Any]] = []
    for i, topic in enumerate(clean, start=1):
        items.append({
            "date": d.isoformat(),
            "country": COUNTRY,
            "rank": i,
            "topic": topic,
            "popularity": None,
            "raw": topic,
            "source": "trend-calendar",
        })
    if not items:
        print(f"[warn] {d.isoformat()} — found heading but no items; page layout may differ")
    return items

def robots_allows() -> bool:
    try:
        r = requests.get(ROBOTS_URL, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if r.status_code != 200:
            return True
        txt = r.text.lower()
        return "disallow: /trend" not in txt
    except Exception:
        return True

# ---------------- CSV helpers ----------------
def ensure_header(csv_path: Path):
    if csv_path.exists() and csv_path.stat().st_size > 0:
        return
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["date","country","rank","topic","popularity","raw","source"])
        w.writeheader()

def load_done_keys(csv_path: Path) -> set[str]:
    if not csv_path.exists():
        return set()
    done = set()
    with csv_path.open("r", newline="", encoding="utf-8") as f:
        rdr = csv.DictReader(f)
        # mark a (country|date) as done if any row exists for that day
        for row in rdr:
            done.add(f"{row['country']}|{row['date']}")
    return done

# ---------------- discovery ----------------
def page_exists(d: date) -> bool:
    try:
        r = requests.get(BASE_FMT.format(iso=d.isoformat()), headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        return r.status_code == 200
    except Exception:
        return False

def discover_earliest_available(back_days: int = 4000, miss_streak_stop: int = 30) -> Optional[date]:
    """
    Probe backwards from today up to ~11 years (4000 days) and find the earliest date
    where a page exists, stopping after a streak of 30 misses once we've found at least one.
    Returns earliest existing date (or None if none found).
    """
    today = datetime.now(UTC).date()
    earliest = None
    found_any = False
    miss_streak = 0
    for n in range(back_days):
        d = today - timedelta(days=n)
        if page_exists(d):
            found_any = True
            earliest = d  # keep updating, so we end with the oldest found
            miss_streak = 0
        else:
            miss_streak += 1
            if found_any and miss_streak >= miss_streak_stop:
                break
        time.sleep(0.2)  # light probe throttle
    return earliest

# ---------------- main run ----------------
def daterange(start: date, end: date) -> List[date]:
    if start > end: start, end = end, start
    return [start + timedelta(days=n) for n in range((end - start).days + 1)]

def run(auto: bool, start_s: Optional[str], end_s: Optional[str]):
    if not robots_allows():
        print("robots.txt disallows /trend — aborting.")
        return 2

    ensure_header(OUT_PATH)
    done = load_done_keys(OUT_PATH)

    if auto:
        # discover earliest and set end = today
        earliest = discover_earliest_available(back_days=4000, miss_streak_stop=30)
        if earliest is None:
            print("Auto-discovery failed; no pages found. Provide --start/--end.")
            return 1
        s, e = earliest, datetime.now(UTC).date()
        print(f"Auto range: {s} -> {e}")
    else:
        if not start_s or not end_s:
            print("Provide both --start and --end, or use --auto.")
            return 1
        s, e = date.fromisoformat(start_s), date.fromisoformat(end_s)

    with OUT_PATH.open("a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["date","country","rank","topic","popularity","raw","source"])
        for d in daterange(s, e):
            key = f"{COUNTRY}|{d.isoformat()}"
            if key in done:
                print(f"[skip] {key}")
                continue
            try:
                rows = fetch_day(d)
                for r in rows:
                    w.writerow(r)
                print(f"[ok]   {key} -> {len(rows)} items")
            except requests.HTTPError as e:
                print(f"[http] {key} -> {e}")
            except Exception as e:
                print(f"[err]  {key} -> {e}")
            time.sleep(SLEEP_SEC)

    print(f"✅ Done. CSV at: {OUT_PATH.resolve()}")
    return 0

if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Scrape US top-3 Twitter trends per day into a single CSV (resumable).")
    ap.add_argument("--auto", action="store_true", help="Discover earliest available date and scrape through today")
    ap.add_argument("--start", help="YYYY-MM-DD")
    ap.add_argument("--end", help="YYYY-MM-DD")
    args = ap.parse_args()
    sys.exit(run(args.auto, args.start, args.end))
