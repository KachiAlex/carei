#!/bin/bash
# Polls origin/main; redeploys the api container when new commits land
# that touch backend code. Runs from cron every 2 minutes.
set -euo pipefail

cd /var/www/carei
git fetch origin main -q

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

if ! git diff --name-only "$LOCAL" "$REMOTE" | grep -qE '^(api|server|migrations)/'; then
  git pull --ff-only origin main -q
  exit 0
fi

echo "[$(date -Is)] Deploying $LOCAL -> $REMOTE"
git pull --ff-only origin main -q

cd server
docker compose up -d --build api

sleep 8
curl -sf http://127.0.0.1:3012/health && echo " [$(date -Is)] OK"
