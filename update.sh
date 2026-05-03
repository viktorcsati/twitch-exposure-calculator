#!/bin/bash
# Standalone update script - v2 (Fully detached)
LOG_FILE="/app/data/update.log"
HOST_CODE_DIR="/app/host_code"

# Ensure log directory exists
mkdir -p /app/data

{
    echo "--- UPDATE STARTED: $(date) ---"
    
    # 1. Fix Git security permissions
    git config --global --add safe.directory "$HOST_CODE_DIR"
    
    # 2. Pull latest code
    echo "Pulling latest code from origin/main..."
    cd "$HOST_CODE_DIR" || exit
    git fetch origin main
    git reset --hard origin/main
    
    # 3. Rebuild and Restart in a way that survives container death
    echo "Rebuilding and restarting containers (Background)..."
    # We use ( ) & to background the compose command entirely
    (sleep 2 && docker compose -f "$HOST_CODE_DIR/docker-compose.yml" up -d --build) &
    
    echo "Update process dispatched. Container will restart shortly."
} >> "$LOG_FILE" 2>&1
