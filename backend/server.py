# server.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import json
from pathlib import Path
import os
from dotenv import load_dotenv
import csv
import random

# Load environment variables from .env file
load_dotenv()

# Import your existing modules
try:
    from llm_client import chat, embed_texts
    HAS_LLM = True
except ImportError:
    HAS_LLM = False
    print("[WARN] llm_client not available")

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DateRange(BaseModel):
    start: str
    end: str

class PredictRequest(BaseModel):
    prompt: str
    date_range: Optional[DateRange] = None

class PredictResponse(BaseModel):
    top_trend: str
    message: str


def load_trends_from_csv(start_date: Optional[str] = None, end_date: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
    """Load trends directly from CSV with date filtering"""
    csv_path = Path("data") / "trends_min_us.csv"
    if not csv_path.exists():
        print(f"[ERROR] CSV not found at {csv_path}")
        return []
    
    trends = []
    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            date = row.get("date", "")
            
            # Filter by date range
            if start_date and date < start_date:
                continue
            if end_date and date > end_date:
                continue
            
            trends.append({
                "date": date,
                "rank": row.get("rank", "1"),
                "topic": row.get("topic", ""),
                "year": date[:4] if date else ""
            })
    
    # If we have trends, shuffle and limit to get variety
    if trends:
        # Prioritize rank 1 trends but include some variety
        rank1 = [t for t in trends if t["rank"] == "1"]
        others = [t for t in trends if t["rank"] != "1"]
        
        random.shuffle(rank1)
        random.shuffle(others)
        
        result = rank1[:limit//2] + others[:limit//2]
        random.shuffle(result)
        return result[:limit]
    
    return []


def get_top_trend_from_list(trends: List[Dict[str, Any]]) -> str:
    """Pick the most interesting top trend"""
    if not trends:
        return "Historical Twitter Trends"
    
    # Prefer rank 1 trends that aren't hashtags
    non_hashtag_rank1 = [t for t in trends if t.get("rank") == "1" and not t["topic"].startswith("#")]
    if non_hashtag_rank1:
        return non_hashtag_rank1[0]["topic"]
    
    # Fall back to any rank 1
    rank1 = [t for t in trends if t.get("rank") == "1"]
    if rank1:
        return rank1[0]["topic"]
    
    # Last resort
    return trends[0]["topic"]


@app.get("/")
def read_root():
    return {"status": "ok", "service": "teatime.ai API"}


@app.post("/api/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """Main prediction endpoint"""
    print(f"\n{'='*60}")
    print(f"[API] Received request: {request.prompt}")
    print(f"[API] Date range: {request.date_range}")
    print(f"{'='*60}\n")
    
    try:
        # Check if API key is set
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500, 
                detail="OPENROUTER_API_KEY not set. Please configure your API key in .env file."
            )

        # Parse date range if provided
        start_date_str = None
        end_date_str = None
        date_context = ""
        
        if request.date_range:
            try:
                start_dt = datetime.fromisoformat(request.date_range.start.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(request.date_range.end.replace('Z', '+00:00'))
                start_date_str = start_dt.date().isoformat()
                end_date_str = end_dt.date().isoformat()
                date_context = f"from {start_dt.strftime('%B %Y')} to {end_dt.strftime('%B %Y')}"
                print(f"[DEBUG] Searching trends from {start_date_str} to {end_date_str}")
            except Exception as e:
                print(f"[WARN] Date parsing error: {e}")
                raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

        # Load trends from CSV
        trends = load_trends_from_csv(start_date_str, end_date_str, limit=25)
        
        print(f"[DEBUG] Found {len(trends)} trends")
        if trends:
            print(f"[DEBUG] Sample topics: {[t['topic'] for t in trends[:5]]}")
        
        if not trends:
            return PredictResponse(
                top_trend="No Trends Found",
                message=f"No trends were found for the specified period {date_context}. Try selecting a different date range on the timeline, or leave it blank to search all available Twitter history."
            )

        # Get top trend for display
        top_trend = get_top_trend_from_list(trends)
        print(f"[DEBUG] Top trend: {top_trend}")

        # Generate prediction using LLM
        if not HAS_LLM:
            raise HTTPException(status_code=500, detail="LLM client not available")

        # Format topics for the prompt (show variety)
        topics_list = "\n".join([
            f"- {t['topic']} (trending {t['date']})"
            for t in trends[:12]
        ])
        
        date_phrase = f" {date_context}" if date_context else ""
        
        system_prompt = """You are teatime.ai - a creative oracle that reads the future by interpreting historical Twitter trending topics. 

Your job: Answer the user's question by weaving together insights from the actual trending topics provided. Be clever, witty, and insightful. Find unexpected connections between the cultural moments reflected in these trends and the user's question.

Rules:
- Keep your response under 120 words
- Be creative but make genuine connections to the trends
- Don't just list trends - tell a story or make a prediction
- Be helpful and engaging
- If the trends don't relate to the question, find creative cultural parallels"""

        user_prompt = f"""User's question: "{request.prompt}"

Twitter trends{date_phrase}:
{topics_list}

Based on these actual trending moments from Twitter history, provide an insightful, creative answer to the user's question. Connect the cultural zeitgeist reflected in these trends to their query in an unexpected but meaningful way."""

        try:
            print("[DEBUG] Calling LLM...")
            message = chat(system_prompt, user_prompt, max_tokens=250)
            print(f"[DEBUG] LLM response: {message[:100]}...")
        except Exception as e:
            print(f"[ERROR] LLM generation failed: {e}")
            # Fallback message
            sample_topics = ", ".join([t['topic'] for t in trends[:4]])
            message = f"Drawing from trends like {sample_topics}{date_phrase}, these cultural moments reveal interesting patterns. {request.prompt} - the answer may lie in how these topics shaped public discourse and attention during this period."

        return PredictResponse(
            top_trend=top_trend,
            message=message
        )

    except HTTPException as he:
        print(f"[ERROR] HTTP Exception: {he.detail}")
        raise
    except Exception as e:
        import traceback
        print(f"\n{'='*60}")
        print("[ERROR] FULL EXCEPTION:")
        print(f"{'='*60}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)