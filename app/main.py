from fastapi import FastAPI
from contextlib import asynccontextmanager
from .database import engine
from . import models, worker

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

@app.get("/")
async def root():
    return {"message": "Twitch Exposure Calculator API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/collect-now")
async def trigger_collection():
    """Manual trigger for data collection"""
    await worker.collect_twitch_data()
    return {"status": "Collection triggered"}
