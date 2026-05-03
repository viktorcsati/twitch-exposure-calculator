from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas
from typing import List
import re

def calculate_score(total_viewers: int, total_channels: int, top_10_share: float, user_ccv: int) -> float:
    # 1. Opportunity: 1 - saturation (higher is better)
    # Low saturation means viewers are distributed, not just watching top 1
    opportunity = 1.0 - top_10_share
    
    # 2. Viewer Density: Viewers per channel
    density = total_viewers / (total_channels if total_channels > 0 else 1)
    
    # 3. Placement Score: How high would the user be?
    # Estimate avg viewer count of top 10 streams
    avg_top_10 = (total_viewers * top_10_share) / 10 if total_viewers > 0 else 0
    
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
    return score

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
        density = m.total_viewers / (m.total_channels if m.total_channels > 0 else 1)
        score = calculate_score(m.total_viewers, m.total_channels, m.top_10_viewer_share, user_ccv)
        
        # Robustly replace {width}x{height} or any existing 123x456 dimensions with 600x800
        art_url = m.game.box_art_url
        art_url = re.sub(r'\{width\}x\{height\}', '600x800', art_url)
        art_url = re.sub(r'\d+x\d+', '600x800', art_url)
        
        recommendations.append(schemas.Recommendation(
            game_id=m.game_id,
            game_name=m.game.name,
            discoverability_score=round(score * 100, 2),
            avg_viewers_per_channel=round(density, 2),
            saturation_percent=round(m.top_10_viewer_share * 100, 2),
            box_art_url=art_url
        ))

    # Sort by score descending
    recommendations.sort(key=lambda x: x.discoverability_score, reverse=True)
    return recommendations
