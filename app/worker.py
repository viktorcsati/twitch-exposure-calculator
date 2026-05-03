from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, twitch_api
import asyncio
import logging
import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def collect_twitch_data():
    logger.info("Starting Twitch data collection task...")
    client = twitch_api.TwitchClient()
    db: Session = SessionLocal()
    
    # Use a single timestamp for the entire batch so they can be queried together
    now = datetime.datetime.utcnow()
    
    try:
        top_games = await client.get_top_games(limit=50)
        logger.info(f"Found {len(top_games)} top games. Fetching metrics...")
        
        success_count = 0
        for game_data in top_games:
            try:
                # Update or create game
                game = db.query(models.Game).filter(models.Game.id == game_data["id"]).first()
                if not game:
                    game = models.Game(
                        id=game_data["id"],
                        name=game_data["name"],
                        box_art_url=game_data["box_art_url"]
                    )
                    db.add(game)
                    db.flush() # Ensure game is in DB for metrics FK
                
                # Fetch and save metrics
                metrics_data = await client.get_game_metrics(game.id)
                metrics = models.GameMetrics(
                    game_id=game.id,
                    timestamp=now,
                    total_viewers=metrics_data["total_viewers"],
                    total_channels=metrics_data["total_channels"],
                    top_10_viewer_share=metrics_data["top_10_share"],
                    median_viewers=metrics_data["median_viewers"]
                )
                db.add(metrics)
                success_count += 1
                
                if success_count % 10 == 0:
                    logger.info(f"Processed {success_count}/50 games...")
                    
            except Exception as ge:
                logger.error(f"Error fetching metrics for game {game_data.get('name')}: {ge}")
                continue # Skip this game and continue
            
        db.commit()
        logger.info(f"Successfully collected metrics for {success_count} games at {now}")
    except Exception as e:
        logger.error(f"Critical error during data collection: {e}")
        db.rollback()
    finally:
        db.close()

def start_worker():
    scheduler = AsyncIOScheduler()
    scheduler.add_job(collect_twitch_data, 'interval', minutes=30)
    scheduler.start()
    return scheduler
