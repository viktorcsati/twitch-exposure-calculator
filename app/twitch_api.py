import httpx
import asyncio
from typing import List, Dict, Any, Optional
import os
from dotenv import load_dotenv

load_dotenv()

class TwitchClient:
    def __init__(self):
        self.client_id = os.getenv("TWITCH_CLIENT_ID")
        self.client_secret = os.getenv("TWITCH_CLIENT_SECRET")
        self.channel_name = os.getenv("TWITCH_CHANNEL_NAME")
        self.access_token = None
        self.base_url = "https://api.twitch.tv/helix"
        self.auth_url = "https://id.twitch.tv/oauth2/token"

    async def get_access_token(self):
        async with httpx.AsyncClient() as client:
            params = {
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "grant_type": "client_credentials"
            }
            response = await client.post(self.auth_url, params=params)
            response.raise_for_status()
            data = response.json()
            self.access_token = data["access_token"]
            return self.access_token

    async def get_headers(self):
        if not self.access_token:
            await self.get_access_token()
        return {
            "Client-ID": self.client_id,
            "Authorization": f"Bearer {self.access_token}"
        }

    async def get_user_stats(self) -> Dict[str, Any]:
        """
        Fetches basic stats for the configured channel.
        Since historical CCV requires OAuth, we'll fetch current/last stream info.
        """
        if not self.channel_name:
            return {"ccv": 0, "name": "Not Configured"}
            
        headers = await self.get_headers()
        async with httpx.AsyncClient() as client:
            # Get User ID first
            user_resp = await client.get(
                f"{self.base_url}/users",
                headers=headers,
                params={"login": self.channel_name}
            )
            user_resp.raise_for_status()
            user_data = user_resp.json()["data"]
            if not user_data:
                return {"ccv": 0, "name": "User Not Found"}
            
            user_id = user_data[0]["id"]
            
            # Get current stream info (for live CCV)
            stream_resp = await client.get(
                f"{self.base_url}/streams",
                headers=headers,
                params={"user_id": user_id}
            )
            stream_data = stream_resp.json()["data"]
            
            # If live, return current CCV. If not, we'll just return 0 for now 
            # (Phase 3 can add historical parsing)
            ccv = stream_data[0]["viewer_count"] if stream_data else 0
            
            return {
                "ccv": ccv,
                "name": self.channel_name,
                "is_live": len(stream_data) > 0
            }

    async def get_top_games(self, limit: int = 50) -> List[Dict[str, Any]]:
        headers = await self.get_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/games/top",
                headers=headers,
                params={"first": limit}
            )
            response.raise_for_status()
            return response.json()["data"]

    async def get_game_metrics(self, game_id: str) -> Dict[str, Any]:
        headers = await self.get_headers()
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/streams",
                headers=headers,
                params={"game_id": game_id, "first": 100}
            )
            response.raise_for_status()
            streams = response.json()["data"]
            
            if not streams:
                return {"total_viewers": 0, "total_channels": 0, "top_10_share": 0, "median_viewers": 0}

            viewers = [s["viewer_count"] for s in streams]
            total_viewers = sum(viewers)
            top_10_sum = sum(viewers[:10])
            
            return {
                "total_viewers": total_viewers,
                "total_channels": len(streams),
                "top_10_share": (top_10_sum / total_viewers) if total_viewers > 0 else 0,
                "median_viewers": viewers[len(viewers)//2] if viewers else 0
            }
