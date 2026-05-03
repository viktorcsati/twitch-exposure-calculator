from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, twitch_api
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def collect_twitch_data():
    logger.info("Starting Twitch data collection task...")
    client = twitch_api.TwitchClient()
    db: Session = SessionLocal()
    
    try:
        top_games = await client.get_top_games(limit=50)
        
        for game_data in top_games:
            # Update or create game
            game = db.query(models.Game).filter(models.Game.id == game_data["id"]).first()
            if not game:
                game = models.Game(
                    id=game_data["id"],
                    name=game_data["name"],
                    box_art_url=game_data["box_art_url"]
                )
                db.add(game)
            
            # Fetch and save metrics
            metrics_data = await client.get_game_metrics(game.id)
            metrics = models.GameMetrics(
                game_id=game.id,
                total_viewers=metrics_data["total_viewers"],
                total_channels=metrics_data["total_channels"],
                top_10_viewer_share=metrics_data["top_10_share"],
                median_viewers=metrics_data["median_viewers"]
            )
            db.add(metrics)
            
        db.commit()
        logger.info(f"Successfully collected metrics for {len(top_games)} games.")
    except Exception as e:
        logger.error(f"Error during data collection: {e}")
        db.rollback()
    finally:
        db.close()

def start_worker():
    scheduler = AsyncIOScheduler()
    # Run immediately and then every 30 minutes
    scheduler.add_job(collect_twitch_data, 'interval', minutes=30)
    scheduler.start()
    return scheduler
