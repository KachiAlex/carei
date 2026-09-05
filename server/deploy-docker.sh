#!/bin/bash
set -e

echo "========================================="
echo "  CAREi Docker Deployment"
echo "========================================="

# Stop existing PM2 process if running
pm2 stop carei-api 2>/dev/null || true
pm2 delete carei-api 2>/dev/null || true
pm2 save 2>/dev/null || true

# Stop existing containers if any
docker compose down 2>/dev/null || true

echo ""
echo ">>> Building and starting containers..."
docker compose up -d --build

echo ""
echo ">>> Waiting for containers to start..."
sleep 10

echo ""
echo ">>> Container status:"
docker compose ps

echo ""
echo ">>> Testing API health..."
sleep 5
curl -s http://localhost:3001/health && echo "" || echo "API not ready yet, waiting more..."
sleep 5
curl -s http://localhost:3001/health && echo "" || echo "API still starting..."

echo ""
echo ">>> Testing API endpoint..."
curl -s http://localhost:3001/api/visits && echo ""

echo ""
echo "========================================="
echo "  Docker Deployment Complete!"
echo "========================================="
echo ""
echo "Containers:"
echo "  - carei-db: PostgreSQL 16 (port 127.0.0.1:5433)"
echo "  - carei-api: Express API (port 127.0.0.1:3001)"
echo ""
echo "Nginx proxy: http -> localhost:3001"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f api    # View API logs"
echo "  docker compose logs -f db     # View DB logs"
echo "  docker compose restart api    # Restart API"
echo "  docker compose down           # Stop all"
echo "  docker compose up -d          # Start all"
echo ""
