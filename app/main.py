from fastapi import FastAPI, Depends, Query
from contextlib import asynccontextmanager
from sqlalchemy.orm import Session
from .database import engine, SessionLocal
from . import models, worker, analytics, schemas, twitch_api
from typing import List

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Database
    models.Base.metadata.create_all(bind=engine)
    
    # Start Background Worker
    scheduler = worker.start_worker()
    
    yield
    
    # Shutdown scheduler
    scheduler.shutdown()

app = FastAPI(
    title="Twitch Exposure Calculator API",
    lifespan=lifespan
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
async def root():
    return {"message": "Twitch Exposure Calculator API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/collect-now")
async def trigger_collection():
    await worker.collect_twitch_data()
    return {"status": "Collection triggered"}

@app.get("/user-stats")
async def get_user_stats():
    client = twitch_api.TwitchClient()
    return await client.get_user_stats()

@app.get("/recommend", response_model=List[schemas.Recommendation])
async def recommend_games(
    ccv: int = Query(0, description="Your average concurrent viewers"),
    db: Session = Depends(get_db)
):
    return analytics.get_recommendations(db, user_ccv=ccv)

@app.get("/games")
async def list_games(db: Session = Depends(get_db)):
    return db.query(models.Game).all()
