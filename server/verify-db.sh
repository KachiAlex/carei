#!/bin/bash
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p 5433 << 'SQLEOF'
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT 'users' as table, COUNT(*) as rows FROM users
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'visits', COUNT(*) FROM visits
UNION ALL SELECT 'clients', COUNT(*) FROM clients
UNION ALL SELECT 'carers', COUNT(*) FROM carers
UNION ALL SELECT 'scheduled_visits', COUNT(*) FROM scheduled_visits
UNION ALL SELECT 'tenant_users', COUNT(*) FROM tenant_users
UNION ALL SELECT 'visit_drafts', COUNT(*) FROM visit_drafts
UNION ALL SELECT 'migrations', COUNT(*) FROM _migrations;
SQLEOF
