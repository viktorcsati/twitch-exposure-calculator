#!/bin/bash
# Standalone update script - v4 (Ephemeral Container Detachment)
LOG_FILE="/app/data/update.log"
HOST_CODE_DIR="/app/host_code"

mkdir -p /app/data

{
    echo "--- ROBUST UPDATE STARTED: $(date) ---"
    
    # 1. Update the code locally (since host directory is mounted at $HOST_CODE_DIR)
    echo "Updating code via Git in current container..."
    git config --global --add safe.directory "$HOST_CODE_DIR"
    cd "$HOST_CODE_DIR" || exit
    git fetch origin main
    git reset --hard origin/main
    echo "Git sync complete."
    
    # 2. Get host path for the project to mount it into the ephemeral container
    CONTAINER_ID=$(hostname)
    HOST_PATH=$(docker inspect "$CONTAINER_ID" -f '{{range .Mounts}}{{if eq .Destination "/app/host_code"}}{{.Source}}{{end}}{{end}}')
    
    if [ -z "$HOST_PATH" ]; then
        echo "ERROR: Could not determine host path for project."
        exit 1
    fi
    
    # 3. Dispatch ephemeral container to rebuild stack
    # This container runs independently of the current backend's lifecycle.
    echo "Spawning ephemeral container to rebuild stack from $HOST_PATH..."
    docker run --rm -d \
      --name twitch-rebuilder-$(date +%s) \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "$HOST_PATH:/app/host_code" \
      -w /app/host_code \
      docker:latest \
      sh -c "sleep 2 && docker compose up -d --build"
    
    echo "Update dispatched successfully. Rebuild in progress in detached container."
} >> "$LOG_FILE" 2>&1
