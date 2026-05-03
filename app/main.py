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

@app.get("/search", response_model=schemas.Recommendation)
async def search_game(q: str = Query(...), ccv: int = Query(0)):
    client = twitch_api.TwitchClient()
    results = await client.search_categories(q)
    if not results:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Take the first result
    game = results[0]
    metrics = await client.get_game_metrics(game["id"])
    
    score = analytics.calculate_score(
        metrics["total_viewers"],
        metrics["total_channels"],
        metrics["top_10_share"],
        ccv
    )
    
    return schemas.Recommendation(
        game_id=game["id"],
        game_name=game["name"],
        discoverability_score=round(score * 100, 2),
        avg_viewers_per_channel=round(metrics["total_viewers"] / (metrics["total_channels"] if metrics["total_channels"] > 0 else 1), 2),
        saturation_percent=round(metrics["top_10_share"] * 100, 2),
        box_art_url=game["box_art_url"].replace("{width}", "188").replace("{height}", "250")
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
