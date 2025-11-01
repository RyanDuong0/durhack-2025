import os, requests, textwrap, random

# Model choice from your list (cheap + good):
GEN_MODEL = os.getenv("TEATIME_MODEL", "openai/gpt-4o-2024-05-13")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

SYSTEM = ("You are teatime.ai — a playful oracle that predicts the future by remixing "
          "historical trending topics. Be witty and under 70 words. Never harmful. "
          "Output a short title on the first line, then a single short paragraph.")

def generate_prophecy(question: str, ingredients: list, mode: str = "sensible") -> str:
    """Calls OpenRouter. Falls back to template if key missing or request fails."""
    topics = ", ".join(f'{i.get("topic")} ({i.get("year")})' for i in ingredients[:8])
    chaos_hint = "Turn up whimsy and surprise." if mode == "chaotic" else "Lean plausible and clever."
    prompt = textwrap.dedent(f"""
        Question: {question}
        Legacy ingredients: {topics}
        Style: {chaos_hint}
        Format: Title on first line, then one paragraph (<70 words).
    """).strip()

    if not OPENROUTER_API_KEY:
        return _template_fallback(question, ingredients)

    try:
        r = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}",
                     "Content-Type": "application/json"},
            json={
                "model": GEN_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.8 if mode == "sensible" else 1.1
            },
            timeout=60
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()
    except Exception:
        # graceful fallback for demo reliability
        return _template_fallback(question, ingredients)

# Friendly fallback (offline / key missing)
_TITLES = ["Leaves Speak", "Second Steep", "Oracle Steam", "Tomorrow’s Brew"]
_VERBS  = ["returns", "mutates", "collides", "ascends", "haunts"]
_TONES  = ["whimsical", "ominous", "sparkling", "chaotic", "cozy"]
def _template_fallback(question, ingredients):
    tops = [i["topic"] for i in ingredients[:4]] or ["old vibes"]
    title = random.choice(_TITLES)
    line = f"In echoes of {', '.join(tops[:-1])} and {tops[-1]}, the future {random.choice(_VERBS)}."
    return f"🫖 {title}\n{line} Your question: {question}. Sip carefully — vibes feel {random.choice(_TONES)}."
