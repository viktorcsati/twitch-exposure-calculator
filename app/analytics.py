from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from typing import List

def get_recommendations(db: Session, user_ccv: int = 0) -> List[schemas.Recommendation]:
    # Get the latest timestamp from the metrics
    latest_timestamp = db.query(func.max(models.GameMetrics.timestamp)).scalar()
    
    if not latest_timestamp:
        return []

    # Get latest metrics for all games
    latest_metrics = db.query(models.GameMetrics).filter(
        models.GameMetrics.timestamp == latest_timestamp
    ).all()

    recommendations = []
    for m in latest_metrics:
        # Calculate scores
        # 1. Opportunity: 1 - saturation (higher is better)
        opportunity = 1.0 - m.top_10_viewer_share
        
        # 2. Viewer Density: Viewers per channel
        density = m.total_viewers / (m.total_channels if m.total_channels > 0 else 1)
        
        # 3. Discoverability Score: Balance of opportunity and density
        # We weight opportunity heavily because high saturation kills growth
        score = (opportunity * 0.7) + ((min(density, 100) / 100) * 0.3)
        
        recommendations.append(schemas.Recommendation(
            game_id=m.game_id,
            game_name=m.game.name,
            discoverability_score=round(score * 100, 2),
            avg_viewers_per_channel=round(density, 2),
            saturation_percent=round(m.top_10_viewer_share * 100, 2),
            box_art_url=m.game.box_art_url.replace("{width}", "188").replace("{height}", "250")
        ))

    # Sort by score descending
    recommendations.sort(key=lambda x: x.discoverability_score, reverse=True)
    return recommendations
