#!/bin/bash
set -e

echo ">>> Dropping existing schema..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p 5433 << 'SQLEOF'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO carei;
GRANT ALL ON SCHEMA public TO public;
SQLEOF

echo ""
echo ">>> Loading fixed schema..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p 5433 -f /tmp/export_schema.sql 2>&1 | grep -E "(ERROR|CREATE)" | tail -20

echo ""
echo ">>> Loading data..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p 5433 -f /tmp/export_data.sql 2>&1 | grep -E "(ERROR|INSERT)" | tail -20

echo ""
echo ">>> Verifying..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p 5433 << 'SQLEOF'
SELECT COUNT(*) as total_tables FROM pg_tables WHERE schemaname='public';
SELECT 'users' as tbl, COUNT(*) as rows FROM users
UNION ALL SELECT 'care_plans', COUNT(*) FROM care_plans
UNION ALL SELECT 'family_members', COUNT(*) FROM family_members
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'visits', COUNT(*) FROM visits;
SQLEOF

echo ""
echo ">>> Re-import complete!"
