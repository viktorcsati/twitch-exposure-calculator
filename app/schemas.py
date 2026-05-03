from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class GameBase(BaseModel):
    id: str
    name: str
    box_art_url: str

class GameMetricsBase(BaseModel):
    timestamp: datetime
    total_viewers: int
    total_channels: int
    top_10_viewer_share: float
    median_viewers: float

class Recommendation(BaseModel):
    game_id: str
    game_name: str
    discoverability_score: float
    avg_viewers_per_channel: float
    saturation_percent: float
    box_art_url: str
    potential_rank: Optional[int] = None
