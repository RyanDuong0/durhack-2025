# build_topic_embeddings_from_min.py
from __future__ import annotations
import os, json, time
from pathlib import Path
import numpy as np
import requests

IN = Path("data") / "trends_topic_summary.json"
EOUT = Path("data") / "topic_embeddings.npy"
IOUT = Path("data") / "topic_index.json"

API_KEY = os.getenv("OPENROUTER_API_KEY")
MODEL = "openai/text-embedding-3-small"
API_URL = "https://openrouter.ai/api/v1/embeddings"

def embed_batch(batch: list[str]) -> list[list[float]]:
    headers = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
    payload = {"model": MODEL, "input": batch}
    r = requests.post(API_URL, headers=headers, json=payload, timeout=60)
    r.raise_for_status()
    data = r.json()
    return [d["embedding"] for d in data["data"]]

def main():
    if not API_KEY:
        print("❌ Set OPENROUTER_API_KEY in your environment.")
        return 2
    if not IN.exists():
        print("❌ Run build_topic_summary_from_min.py first.")
        return 2

    topics = json.loads(IN.read_text(encoding="utf-8"))
    docs, index = [], []
    for t in topics:
        desc = (
            f"Topic: {t['topic']}\n"
            f"First seen: {t['first_seen']}\n"
            f"Last seen: {t['last_seen']}\n"
            f"Days active: {t['days_seen']}\n"
            f"Years active: {', '.join(t['years_active'])}\n"
        )
        docs.append(desc)
        index.append({"topic": t["topic"], "first_seen": t["first_seen"], "last_seen": t["last_seen"], "days_seen": t["days_seen"]})

    all_embs = []
    for i in range(0, len(docs), 128):
        batch = docs[i:i+128]
        embs = embed_batch(batch)
        all_embs.extend(embs)
        print(f"[embed] {i+len(batch)}/{len(docs)}")
        time.sleep(0.25)

    arr = np.array(all_embs, dtype=np.float32)
    EOUT.parent.mkdir(parents=True, exist_ok=True)
    np.save(EOUT, arr)
    IOUT.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"✅ Saved {EOUT} ({arr.shape})")
    print(f"✅ Saved {IOUT} ({len(index)} topics)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
