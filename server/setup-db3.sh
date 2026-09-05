#!/bin/bash
set -e

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
PG_CONF="/etc/postgresql/16/main/postgresql.conf"
PGPORT=5433

echo ">>> Current pg_hba.conf (non-comment lines):"
grep -v "^#" "$PG_HBA" | grep -v "^$"

echo ""
echo ">>> Temporarily allowing trust auth for all local connections..."
# Backup
cp "$PG_HBA" "${PG_HBA}.bak"

# Replace all local auth with trust temporarily
sed -i 's/^local\s\+\(all\|replication\)\s\+\(postgres\|all\)\s\+\(md5\|peer\|scram-sha-256\|trust\)/local   \1   \2   trust/' "$PG_HBA"

echo "After sed:"
grep -v "^#" "$PG_HBA" | grep -v "^$"

systemctl restart postgresql

echo ""
echo ">>> Creating/fixing carei user and database..."
psql -U postgres -p $PGPORT -c "DROP USER IF EXISTS carei;" 2>&1 || true
psql -U postgres -p $PGPORT -c "CREATE USER carei WITH PASSWORD 'CareiDB2026!Secure';" 2>&1
psql -U postgres -p $PGPORT -c "DROP DATABASE IF EXISTS carei;" 2>&1 || true
psql -U postgres -p $PGPORT -c "CREATE DATABASE carei OWNER carei;" 2>&1
psql -U postgres -p $PGPORT -c "GRANT ALL PRIVILEGES ON DATABASE carei TO carei;" 2>&1

echo ""
echo ">>> Testing carei connection on port $PGPORT..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p $PGPORT -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Restoring original pg_hba.conf..."
cp "${PG_HBA}.bak" "$PG_HBA"

# Add carei-specific auth lines
if ! grep -q "carei" "$PG_HBA"; then
  echo "local   carei   carei   scram-sha-256" >> "$PG_HBA"
  echo "host    carei   carei   127.0.0.1/32   scram-sha-256" >> "$PG_HBA"
  echo "host    carei   carei   ::1/128        scram-sha-256" >> "$PG_HBA"
fi

systemctl restart postgresql

echo ""
echo ">>> Final test with restored auth..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p $PGPORT -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Database setup complete!"
echo "Connection string: postgresql://carei:CareiDB2026!Secure@127.0.0.1:5433/carei"
