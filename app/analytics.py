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
        # 1. Opportunity: 1 - saturation (higher is better)
        # Low saturation means viewers are distributed, not just watching top 1
        opportunity = 1.0 - m.top_10_viewer_share
        
        # 2. Viewer Density: Viewers per channel
        density = m.total_viewers / (m.total_channels if m.total_channels > 0 else 1)
        
        # 3. Placement Score: How high would the user be?
        # Estimate avg viewer count of top 10 streams
        avg_top_10 = (m.total_viewers * m.top_10_viewer_share) / 10 if m.total_viewers > 0 else 0
        
        if user_ccv > 0:
            # If user has more CCV than the avg top 10, they are very likely to be discoverable
            # We cap this at 1.0
            placement = min(user_ccv / (avg_top_10 if avg_top_10 > 0 else 1), 1.0)
        else:
            # If no CCV provided, use a neutral placement score based on median
            placement = 0.5

        # 4. Final Score Calculation:
        # Weighting: 40% Opportunity, 30% Placement, 30% Density
        score = (opportunity * 0.4) + (placement * 0.3) + ((min(density, 100) / 100) * 0.3)
        
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
