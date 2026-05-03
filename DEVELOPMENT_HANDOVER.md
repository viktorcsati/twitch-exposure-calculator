# Twitch Exposure Calculator - Handover & Future Plan

## 1. Project Context
- **Goal:** Calculate the best Twitch category to stream in for maximum discoverability.
- **Workflow:** **Bridge Workflow**. Development happens locally -> Pushed to GitHub -> Pulled/Built on Proxmox LXC (192.168.100.17).
- **Stack:** Python (FastAPI), SQLite (SQLAlchemy), React (Vite/Tailwind), Docker Compose.

## Current State (v1.0.5)
### Functional:
- **Twitch Data Engine:** Robust collection with per-game error handling (prevents batch loss).
- **Worker:** Resilient to individual game timeouts.
- **Analytics:** **New Score v2** (40% saturation, 30% placement based on CCV, 30% viewer density).
- **Pro Dashboard:** Refined "Gaming Only" blacklist to prevent false positives (e.g. Hearthstone).
- **Versioning:** Robust version detection logic.

### In-Progress / Issues:
- **Auto Updater:** NOT WORKING. Needs a complete architectural rethink as background shell dispatch is failing.
- **Pinned Games:** NO PICTURE. Cards are appearing but images are not rendering correctly.
- **Steam Integration:** Logic for fetching user library is planned.

## 3. Immediate Next Steps
1. **Phase 2 - Steam Integration:** 
   - Add `STEAM_API_KEY` and `STEAM_ID` to `.env`.
   - Implement `steam_api.py` to fetch owned games.
   - Match Steam game names to Twitch categories.
2. **Phase 3 - Historical Analysis:** Add a view to see how discoverability scores for a game change over a 24-hour cycle.

## 4. Self-Update Command (Internal)
The "Update App Code" button triggers:
```bash
git -C /app/host_code pull origin main
docker compose -f /app/host_code/docker-compose.yml up -d --build
```
*Note: If this fails, the user must run the manual steps in the LXC terminal.*
