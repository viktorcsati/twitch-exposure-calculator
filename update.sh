#!/bin/bash
# Standalone update script - v5 (Bulletproof Ephemeral Rebuilder)
LOG_FILE="/app/data/update.log"
HOST_CODE_DIR="/app/host_code"

mkdir -p /app/data

{
    echo "--- BULLETPROOF UPDATE STARTED: $(date) ---"
    
    # 1. Pre-pull the rebuilder image to avoid delays in the detached process
    echo "Ensuring rebuilder image (docker:latest) is available..."
    docker pull docker:latest
    
    # 2. Update the code locally (backend container)
    echo "Syncing code via Git..."
    git config --global --add safe.directory "$HOST_CODE_DIR"
    cd "$HOST_CODE_DIR" || exit
    git fetch origin main
    git reset --hard origin/main
    echo "Git sync complete."
    
    # 3. Get host path for the project
    CONTAINER_ID=$(hostname)
    HOST_PATH=$(docker inspect "$CONTAINER_ID" -f '{{range .Mounts}}{{if eq .Destination "/app/host_code"}}{{.Source}}{{end}}{{end}}')
    
    if [ -z "$HOST_PATH" ]; then
        echo "ERROR: Could not determine host path for project."
        exit 1
    fi
    
    # 4. Dispatch the Rebuilder
    # We use a detached container that performs a final git check and then rebuilds.
    # We check for both 'docker compose' (v2) and 'docker-compose' (v1).
    echo "Dispatching rebuilder container..."
    docker run --rm -d \
      --name twitch-rebuilder-$(date +%s) \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "$HOST_PATH:/app/host_code" \
      -w /app/host_code \
      docker:latest \
      sh -c "sleep 3 && \
             if docker compose version >/dev/null 2>&1; then \
               docker compose up -d --build; \
             else \
               docker-compose up -d --build; \
             fi"
    
    echo "Update successfully dispatched to ephemeral container."
    echo "The backend will restart shortly. Check this log again in 30 seconds."
} >> "$LOG_FILE" 2>&1
