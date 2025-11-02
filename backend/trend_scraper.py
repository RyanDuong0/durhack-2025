# trend_scraper.py
from __future__ import annotations
import time, json, re, sys
from pathlib import Path
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

# ------------------ config ------------------
USER_AGENT = "teatime.ai-hackathon-bot/1.0 (+contact: you@example.com)"
SLEEP_SEC = 1.0
TIMEOUT = 20
COUNTRY_DEFAULT = "us"
BASE_FMT = "https://{country}.trend-calendar.com/trend/{iso}.html"
SITEMAP_FMT = "https://{country}.trend-calendar.com/sitemap.xml"

DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw" / "trend_calendar"
RAW_DIR.mkdir(parents=True, exist_ok=True)

# ------------------ robots check ------------------
def robots_allows(country: str) -> bool:
    host = f"https://{country}.trend-calendar.com"
    robots_url = f"{host}/robots.txt"
    try:
        r = requests.get(robots_url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if r.status_code != 200:
            return True
        txt = r.text.lower()
        return "disallow: /trend" not in txt
    except Exception:
        return True

# ------------------ sitemap -> available dates ------------------
def get_dates_from_sitemap(country: str) -> List[date]:
    url = SITEMAP_FMT.format(country=country)
    try:
        r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
        if r.status_code != 200:
            return []
        soup = BeautifulSoup(r.text, "lxml-xml")
        urls = [loc.get_text(strip=True) for loc in soup.find_all("loc")]
        dates: List[date] = []
        for u in urls:
            # look for /trend/YYYY-MM-DD.html
            m = re.search(r"/trend/(\d{4})-(\d{2})-(\d{2})\.html$", u)
            if m:
                y, mth, d = map(int, m.groups())
                dates.append(date(y, mth, d))
        return sorted(set(dates))
    except Exception:
        return []

# ------------------ parser helpers ------------------
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
    chunk = raw_text.split("(")[0].split(" - ")[0].strip()
    chunk = re.sub(r"^\d+\.\s*", "", chunk)  # drop leading rank like '1. '
    return chunk.lower()

def parse_trends_top3(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    selectors = [
        ".trend-item", ".trend-list li", "ol li", "ul li", "table tr"
    ]
    nodes = []
    for sel in selectors:
        nodes = soup.select(sel)
        if nodes: break
    if not nodes:
        nodes = soup.find_all("li")

    items = []
    for node in nodes[:3]:  # <-- top 3 only
        text = node.get_text(" ", strip=True)
        if not text: continue
        topic = _extract_topic(text)
        if not topic or topic in ("trend", "trends"): continue
        pop = _parse_popularity(text)
        items.append({"topic": topic, "raw": text, "popularity": pop})
    for i, it in enumerate(items, start=1):
        it["rank"] = i
    return items

# ------------------ fetcher ------------------
def fetch_day(country: str, d: date) -> List[Dict[str, Any]]:
    url = BASE_FMT.format(country=country, iso=d.isoformat())
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    if r.status_code == 404:
        return []
    r.raise_for_status()
    return parse_trends_top3(r.text)

# ------------------ runner ------------------
def scrape_dates(country: str, dates: List[date], resume: bool = True) -> int:
    if not robots_allows(country):
        print(f"robots.txt for {country} disallows /trend — aborting.")
        return 2
    total = 0
    for d in dates:
        daily_path = RAW_DIR / country / str(d.year)
        daily_path.mkdir(parents=True, exist_ok=True)
        out_file = daily_path / f"trend_{d.isoformat()}.json"

        if resume and out_file.exists() and out_file.stat().st_size > 0:
            print(f"[skip] {country} {d.isoformat()} (cached)")
            continue
        try:
            items = fetch_day(country, d)
            recs = [
                {
                    "topic": it["topic"], "date": d.isoformat(), "country": country,
                    "rank": it["rank"], "popularity": it.get("popularity"),
                    "raw": it.get("raw"), "source": "trend-calendar",
                }
                for it in items
            ]
            out_file.write_text(json.dumps(recs, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"[ok]   {country} {d.isoformat()} -> {len(recs)} items")
            total += len(recs)
        except requests.HTTPError as e:
            print(f"[http] {country} {d.isoformat()} -> {e}")
        except Exception as e:
            print(f"[err]  {country} {d.isoformat()} -> {e}")
        time.sleep(SLEEP_SEC)

    # write combined
    combined: List[Dict[str, Any]] = []
    for p in (RAW_DIR / country).rglob("trend_*.json"):
        try:
            combined.extend(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            pass
    (RAW_DIR / f"{country}_combined.json").write_text(
        json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"done. total records saved: {total}")
    return 0

def daterange(start: date, end: date) -> List[date]:
    if start > end: start, end = end, start
    days = (end - start).days + 1
    return [start + timedelta(n) for n in range(days)]

# ------------------ cli ------------------
if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(description="Scrape top-3 daily Twitter trends by date range or sitemap auto-range.")
    ap.add_argument("--country", default=COUNTRY_DEFAULT, help="e.g. us, uk, jp")
    ap.add_argument("--start", help="YYYY-MM-DD (optional)")
    ap.add_argument("--end", help="YYYY-MM-DD (optional)")
    ap.add_argument("--no-resume", action="store_true", help="ignore cached JSON and refetch")
    args = ap.parse_args()

    # Determine dates to scrape
    if not args.start and not args.end:
        # Auto-range from sitemap
        ds = get_dates_from_sitemap(args.country)
        if not ds:
            print("Could not read sitemap; please provide --start and --end.")
            sys.exit(1)
        print(f"Auto-range from sitemap: {ds[0]} .. {ds[-1]} ({len(ds)} days)")
        to_scrape = ds
    else:
        if not args.start or not args.end:
            print("Provide both --start and --end or neither (auto-range).")
            sys.exit(1)
        s = date.fromisoformat(args.start)
        e = date.fromisoformat(args.end)
        to_scrape = daterange(s, e)

    sys.exit(scrape_dates(args.country, to_scrape, resume=(not args.no_resume)))
