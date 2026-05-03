from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class Game(Base):
    __tablename__ = "games"

    id = Column(String, primary_key=True)  # Twitch Game ID
    name = Column(String, nullable=False)
    box_art_url = Column(String)
    
    metrics = relationship("GameMetrics", back_populates="game")

class GameMetrics(Base):
    __tablename__ = "game_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    total_viewers = Column(Integer)
    total_channels = Column(Integer)
    
    # Discovery metrics
    top_10_viewer_share = Column(Float)  # Percentage of viewers in top 10 streams
    median_viewers = Column(Float)
    
    game = relationship("Game", back_populates="metrics")
