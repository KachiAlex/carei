#!/bin/bash
echo "=== Rebuilding API container ==="
cd /var/www/carei/docker
docker compose up -d --build api 2>&1

echo "=== Waiting for container to be healthy ==="
sleep 12
docker ps --filter name=carei --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1

echo "=== Testing endpoints ==="
echo "--- Health ---"
curl -s http://127.0.0.1:3012/health
echo ""
echo "--- Compliance Dashboard ---"
curl -s http://127.0.0.1:3012/api/compliance-dashboard
echo ""
echo "--- Risk Alerts ---"
curl -s http://127.0.0.1:3012/api/risk-alerts
echo ""
echo "--- Staff Matching (needs clientId) ---"
curl -s http://127.0.0.1:3012/api/staff-matching
echo ""
echo "--- Report templates list ---"
curl -s -X POST http://127.0.0.1:3012/api/anthropic/report -H 'Content-Type: application/json' -d '{"template":"invalid"}'
echo ""
echo "--- Care Plan (no auth) ---"
curl -s -X POST http://127.0.0.1:3012/api/anthropic/care-plan -H 'Content-Type: application/json' -d '{}'
echo ""
echo "--- Structure Notes (no auth) ---"
curl -s -X POST http://127.0.0.1:3012/api/anthropic/structure-notes -H 'Content-Type: application/json' -d '{}'
echo ""
echo "--- Family Update (no auth) ---"
curl -s -X POST http://127.0.0.1:3012/api/anthropic/family-update -H 'Content-Type: application/json' -d '{}'
echo ""

echo "=== Container logs ==="
docker logs carei-api 2>&1 | tail -20
