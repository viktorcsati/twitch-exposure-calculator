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

def run_system_update():
    log_file = "/app/data/update.log"
    with open(log_file, "a") as f:
        f.write(f"\n--- Update Started at {os.popen('date').read().strip()} ---\n")
        f.write("Configuring safe directory...\n")
        subprocess.run(["git", "config", "--global", "--add", "safe.directory", "/app/host_code"], stderr=f, stdout=f)
        f.write("Pulling latest code...\n")
        subprocess.run(["git", "-C", "/app/host_code", "pull", "origin", "main"], stderr=f, stdout=f)
        f.write("Restarting containers...\n")
        subprocess.run(["docker", "compose", "-f", "/app/host_code/docker-compose.yml", "up", "-d", "--build"], stderr=f, stdout=f)

@app.post("/system/update")
async def update_app(background_tasks: BackgroundTasks):
    background_tasks.add_task(run_system_update)
    return {"status": "Update initiated. Logging to /app/data/update.log"}
