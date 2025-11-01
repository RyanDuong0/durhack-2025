import os, json, requests, numpy as np
from sklearn.metrics.pairwise import cosine_similarity

EMBED_MODEL = "openai/text-embedding-3-small"

def _get_key():
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Put it in .env or set $env:OPENROUTER_API_KEY before running.")
    return key

def _embed_texts(texts):
    key = _get_key()
    r = requests.post(
        "https://openrouter.ai/api/v1/embeddings",
        headers={"Authorization": f"Bearer {key}", "Content-Type":"application/json"},
        json={"model": EMBED_MODEL, "input": texts},
        timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f"Embeddings request failed ({r.status_code}): {r.text[:200]}")
    data = r.json()["data"]
    return np.array([row["embedding"] for row in data], dtype="float32")

class Retriever:
    def __init__(self, trends_path="data/trends_clean.json", emb_path="data/embeddings.npy"):
        self.trends = json.load(open(trends_path, encoding="utf-8"))
        self.emb_path = emb_path
        # ensure folder exists
        os.makedirs(os.path.dirname(self.emb_path), exist_ok=True)
        self._ensure_embeddings()

    def _ensure_embeddings(self):
        # if missing or zero size -> rebuild
        if not os.path.exists(self.emb_path) or os.path.getsize(self.emb_path) == 0:
            self._build_and_save()
        try:
            self.E = np.load(self.emb_path)
        except Exception:
            self._build_and_save()
            self.E = np.load(self.emb_path)

    def _build_and_save(self):
        topics = [t["topic"] for t in self.trends]
        E = _embed_texts(topics)  # will raise if API key is missing/bad

        # write atomically in the same directory
        tmp = self.emb_path + ".tmp.npy"  # ensure .npy extension
        np.save(tmp, E)
        os.replace(tmp, self.emb_path)  # atomic rename on Windows too
        self.E = E

    def _embed_query(self, q: str):
        return _embed_texts([q])[0]

    def topk(self, question: str, k: int = 12):
        q = self._embed_query(question)
        sims = cosine_similarity([q], self.E)[0]
        idx = sims.argsort()[-k:][::-1]
        return [{**self.trends[i], "score": float(sims[i])} for i in idx]

def steep_level(scores):
    m = sum(scores) / max(1, len(scores))
    return "Full" if m >= 0.75 else "Medium" if m >= 0.5 else "Low"
