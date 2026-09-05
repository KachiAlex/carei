#!/bin/bash
set -e

NEON_URL="postgresql://neondb_owner:npg_nTGoBeyY0Hz2@ep-curly-bar-abck2u9o-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
LOCAL_URL="postgresql://carei:CareiDB2026!Secure@127.0.0.1:5433/carei"

echo ">>> Migrating database from Neon to local PostgreSQL..."
echo "    Source: Neon (eu-west-2)"
echo "    Target: localhost:5433/carei"
echo ""

# First, dump the schema from Neon
echo ">>> Step 1: Dumping schema from Neon..."
pg_dump "$NEON_URL" --schema-only --no-owner --no-privileges > /tmp/carei_schema.sql 2>&1
echo "    Schema dumped: $(wc -l < /tmp/carei_schema.sql) lines"

echo ""
echo ">>> Step 2: Dumping data from Neon..."
pg_dump "$NEON_URL" --data-only --no-owner --no-privileges --disable-triggers > /tmp/carei_data.sql 2>&1
echo "    Data dumped: $(wc -l < /tmp/carei_data.sql) lines"

echo ""
echo ">>> Step 3: Loading schema into local database..."
psql "$LOCAL_URL" -f /tmp/carei_schema.sql 2>&1 | tail -5

echo ""
echo ">>> Step 4: Loading data into local database..."
psql "$LOCAL_URL" -f /tmp/carei_data.sql 2>&1 | tail -5

echo ""
echo ">>> Step 5: Verifying migration..."
TABLES=$(psql "$LOCAL_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;")
echo "Tables in local database:"
echo "$TABLES"

echo ""
echo ">>> Row counts:"
for TABLE in $TABLES; do
  COUNT=$(psql "$LOCAL_URL" -t -c "SELECT COUNT(*) FROM $TABLE;" 2>/dev/null | xargs)
  echo "  $TABLE: $COUNT rows"
done

echo ""
echo ">>> Migration complete!"
rm -f /tmp/carei_schema.sql /tmp/carei_data.sql
