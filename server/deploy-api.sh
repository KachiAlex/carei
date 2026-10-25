#!/bin/bash
set -euo pipefail

echo "=== CAREi API deploy ==="
cd /var/www/carei

echo ">>> Pulling latest main..."
git pull --ff-only origin main

echo ">>> Rebuilding api container..."
cd server
docker compose up -d --build api

echo ">>> Waiting for health check..."
sleep 8
curl -sf http://127.0.0.1:3012/health
echo ""
echo "=== Deploy complete ==="
