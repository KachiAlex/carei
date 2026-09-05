#!/bin/bash
echo "=== Checking if outcome_indicators table exists ==="
docker exec carei-db psql -U carei -d carei -c "\dt outcome_indicators" 2>&1

echo "=== Creating table if not exists ==="
docker exec carei-db psql -U carei -d carei -c "
CREATE TABLE IF NOT EXISTS outcome_indicators (
  id TEXT PRIMARY KEY,
  visit_id TEXT REFERENCES visits(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL,
  tenant_id TEXT,
  recorded_by TEXT,
  mobility_score INTEGER CHECK (mobility_score >= 1 AND mobility_score <= 5),
  wellbeing_scale INTEGER CHECK (wellbeing_scale >= 1 AND wellbeing_scale <= 5),
  pain_level INTEGER CHECK (pain_level >= 1 AND pain_level <= 5),
  goal_attainment JSONB,
  behaviour_flags JSONB,
  independence_level INTEGER CHECK (independence_level >= 1 AND independence_level <= 5),
  skin_integrity INTEGER CHECK (skin_integrity >= 1 AND skin_integrity <= 5),
  nutrition_risk INTEGER CHECK (nutrition_risk >= 1 AND nutrition_risk <= 5),
  hydration_risk INTEGER CHECK (hydration_risk >= 1 AND hydration_risk <= 5),
  cognition_level INTEGER CHECK (cognition_level >= 1 AND cognition_level <= 5),
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_outcome_indicators_client ON outcome_indicators(client_id);
CREATE INDEX IF NOT EXISTS idx_outcome_indicators_visit ON outcome_indicators(visit_id);
CREATE INDEX IF NOT EXISTS idx_outcome_indicators_tenant ON outcome_indicators(tenant_id);
" 2>&1

echo "=== Also check for client_settings table (used by family-update) ==="
docker exec carei-db psql -U carei -d carei -c "
CREATE TABLE IF NOT EXISTS client_settings (
  id SERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  tenant_id TEXT,
  key TEXT NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, key)
);
" 2>&1

echo "=== Also check for family_access table ==="
docker exec carei-db psql -U carei -d carei -c "\dt family_access" 2>&1

echo "=== Rebuilding API container ==="
cd /var/www/carei/docker
docker compose up -d --build api 2>&1

echo "=== Waiting for container to be healthy ==="
sleep 10
docker ps --filter name=carei --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1

echo "=== Testing new endpoints ==="
curl -s http://127.0.0.1:3012/health
echo ""
curl -s http://127.0.0.1:3012/api/compliance-dashboard
echo ""
curl -s http://127.0.0.1:3012/api/risk-alerts
echo ""
curl -s http://127.0.0.1:3012/api/anthropic/report -X POST -H 'Content-Type: application/json' -d '{"template":"invalid"}'
echo ""
curl -s http://127.0.0.1:3012/api/anthropic/care-plan -X POST -H 'Content-Type: application/json' -d '{}'
echo ""

echo "=== Container logs ==="
docker logs carei-api 2>&1 | tail -20
