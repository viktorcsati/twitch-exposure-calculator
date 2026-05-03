#!/bin/bash
# Standalone update script to handle the bridge update safely
LOG_FILE="/app/data/update.log"
HOST_CODE_DIR="/app/host_code"

exec > >(tee -a "$LOG_FILE") 2>&1

echo "--- UPDATE STARTED: $(date) ---"

# 1. Fix Git security permissions
git config --global --add safe.directory "$HOST_CODE_DIR"

# 2. Pull latest code
echo "Pulling latest code from origin/main..."
cd "$HOST_CODE_DIR" || exit
git fetch origin main
git reset --hard origin/main

# 3. Rebuild and Restart
echo "Rebuilding and restarting containers..."
# Use a slight delay to allow the API response to finish
(sleep 2 && docker compose -f "$HOST_CODE_DIR/docker-compose.yml" up -d --build) &

echo "Update process dispatched. Containers will restart shortly."
