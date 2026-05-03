#!/bin/bash
# Standalone update script - v3 (Bulletproof Detachment)
LOG_FILE="/app/data/update.log"
HOST_CODE_DIR="/app/host_code"

mkdir -p /app/data

{
    echo "--- RELIABLE UPDATE STARTED: $(date) ---"
    
    # 1. Force Git into a clean state
    git config --global --add safe.directory "$HOST_CODE_DIR"
    cd "$HOST_CODE_DIR" || exit
    echo "Cleaning and fetching..."
    git clean -fd
    git fetch origin main
    git reset --hard origin/main
    
    # 2. Run Docker Compose via NOHUP
    # We use a subshell and redirect all I/O to ensure no SIGHUP when parent dies
    echo "Launching rebuild in detached session..."
    nohup bash -c "sleep 2 && docker compose -f $HOST_CODE_DIR/docker-compose.yml up -d --build" > /dev/null 2>&1 &
    
    echo "Update dispatched successfully. Container restart imminent."
} >> "$LOG_FILE" 2>&1
