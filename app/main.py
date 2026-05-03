from fastapi import FastAPI, Depends, Query, BackgroundTasks
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
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

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()

@app.get("/health")
async def health(): return {"status": "healthy"}

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
    # 1. Pull latest code from Git in the mounted host directory
    subprocess.run(["git", "-C", "/app/host_code", "pull", "origin", "main"])
    # 2. Trigger Docker rebuild of the entire stack
    # We use the docker binary installed in the container which talks to the host socket
    subprocess.run(["docker", "compose", "-f", "/app/host_code/docker-compose.yml", "up", "-d", "--build"])

@app.post("/system/update")
async def update_app(background_tasks: BackgroundTasks):
    """Triggers a git pull and docker rebuild on the host"""
    background_tasks.add_task(run_system_update)
    return {"status": "Update initiated. App will restart in ~30 seconds."}
