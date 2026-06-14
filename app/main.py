from fastapi import FastAPI, Depends, Query, BackgroundTasks
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from sqlalchemy import func
import subprocess
import os
from .database import engine, SessionLocal
from . import models, worker, analytics, schemas, twitch_api
from typing import List

@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    scheduler = worker.start_worker()
    yield
    scheduler.shutdown()

app = FastAPI(title="Twitch Exposure API", lifespan=lifespan)

# Load version
VERSION = "1.0.6-dev"
try:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    v_path = os.path.join(BASE_DIR, "version.txt")
    if os.path.exists(v_path):
        with open(v_path, "r") as f:
            VERSION = f.read().strip()
    elif os.path.exists("version.txt"):
        with open("version.txt", "r") as f:
            VERSION = f.read().strip()
except Exception:
    pass

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@app.get("/status")
async def get_status(db: Session = Depends(get_db)):
    last_update = db.query(func.max(models.GameMetrics.timestamp)).scalar()
    return {
        "last_update": last_update.isoformat() if last_update else None,
        "is_worker_running": True,
        "version": VERSION
    }

@app.post("/collect-now")
async def trigger_collection():
    await worker.collect_twitch_data()
    return {"status": "Collection triggered"}

@app.get("/user-stats")
async def get_user_stats():
    client = twitch_api.TwitchClient()
    return await client.get_user_stats()

@app.get("/recommend", response_model=List[schemas.Recommendation])
async def recommend_games(ccv: int = Query(0), db: Session = Depends(get_db)):
    return analytics.get_recommendations(db, user_ccv=ccv)

@app.get("/search/suggestions")
async def search_suggestions(q: str = Query(...)):
    client = twitch_api.TwitchClient()
    results = await client.search_categories(q)
    return [{"id": g["id"], "name": g["name"], "box_art_url": g["box_art_url"]} for g in results[:10]]

@app.get("/search", response_model=schemas.Recommendation)
async def search_game(q: str = Query(None), id: str = Query(None), ccv: int = Query(0)):
    client = twitch_api.TwitchClient()
    
    game_id = id
    game_name = q
    box_art = ""

    if not game_id:
        results = await client.search_categories(q)
        if not results:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Game not found")
        game_id = results[0]["id"]
        game_name = results[0]["name"]
        box_art = results[0]["box_art_url"]
    else:
        # If we have an ID, we still want the name and box art for the response
        # We could fetch this or trust the frontend sent enough info (but schemas.Recommendation needs it)
        # For simplicity, let's search if name is missing
        if not game_name:
            results = await client.search_categories(q or "") # This is a bit weak, better to have a get_game by ID
            game_name = next((g["name"] for g in results if g["id"] == game_id), "Unknown")
            box_art = next((g["box_art_url"] for g in results if g["id"] == game_id), "")

    metrics = await client.get_game_metrics(game_id)
    
    score = analytics.calculate_score(
        metrics["total_viewers"],
        metrics["total_channels"],
        metrics["top_10_share"],
        ccv
    )
    
    art_url = analytics.format_box_art_url(box_art)

    return schemas.Recommendation(
        game_id=game_id,
        game_name=game_name,
        discoverability_score=round(score * 100, 2),
        avg_viewers_per_channel=round(metrics["total_viewers"] / (metrics["total_channels"] if metrics["total_channels"] > 0 else 1), 2),
        saturation_percent=round(metrics["top_10_share"] * 100, 2),
        box_art_url=art_url
    )

def run_system_update():
    # Execute the standalone script
    script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "update.sh")
    if os.path.exists(script_path):
        subprocess.run(["bash", script_path])
    else:
        # Fallback if script isn't found in current path
        subprocess.run(["bash", "/app/host_code/update.sh"])

@app.get("/system/update-log")
async def get_update_log():
    log_path = "/app/data/update.log"
    if os.path.exists(log_path):
        with open(log_path, "r") as f:
            return {"log": f.read()[-5000:]} # Return last 5000 chars
    return {"log": "No log found."}

@app.post("/system/update")
async def update_app(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_system_update)
    return {"status": "Update process started. The container will restart in ~5 seconds. Check log after reload."}
