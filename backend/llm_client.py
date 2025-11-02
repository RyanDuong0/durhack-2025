# llm_client.py
from __future__ import annotations
import os, requests, json

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
CHAT_MODEL = os.getenv("TEATIME_MODEL", "openai/gpt-4o")
EMBED_MODEL = os.getenv("TEATIME_EMBED_MODEL", "openai/text-embedding-3-small")

HEADERS = {
    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
}

def embed_texts(texts: list[str]) -> list[list[float]]:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    payload = {"model": EMBED_MODEL, "input": texts}
    r = requests.post("https://openrouter.ai/api/v1/embeddings", headers=HEADERS, json=payload, timeout=60)
    r.raise_for_status()
    data = r.json()
    return [d["embedding"] for d in data["data"]]

def chat(system: str, user: str, max_tokens: int = 320) -> str:
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY not set")
    payload = {
        "model": CHAT_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "max_tokens": max_tokens,
    }
    r = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=HEADERS, data=json.dumps(payload), timeout=60)
    r.raise_for_status()
    j = r.json()
    return j["choices"][0]["message"]["content"].strip()
