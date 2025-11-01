from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from retriever import Retriever, steep_level
from generator import generate_prophecy


R = Retriever()

app = FastAPI(title="teatime.ai")



app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
def ping():
    return {"ok": True}

class BrewReq(BaseModel):
    question: str
    mode: str = "sensible"

@app.post("/brew")
def brew(req: BrewReq):
    ing = R.topk(req.question, k=8)
    lvl = steep_level([i["score"] for i in ing])
    # temporary text until generator is added
    topnames = ", ".join([i["topic"] for i in ing[:3]])
    prophecy = generate_prophecy(req.question, ing, req.mode)
    return {"prophecy": prophecy, "steep_level": lvl, "ingredients": ing[:6], "mode": req.mode}
