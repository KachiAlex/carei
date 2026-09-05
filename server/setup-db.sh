#!/bin/bash
set -e

echo ">>> Checking PostgreSQL auth..."
PG_HBA=$(find /etc/postgresql -name "pg_hba.conf" | head -1)
echo "pg_hba.conf: $PG_HBA"
grep -v "^#" "$PG_HBA" | grep -v "^$"

echo ""
echo ">>> Trying to connect as postgres..."
su postgres -c "psql -c 'SELECT 1;'" 2>&1 || true

echo ""
echo ">>> Setting up carei database..."

# Temporarily set trust auth for local connections
sed -i 's/^local\s\+all\s\+postgres\s\+.*/local   all   postgres   trust/' "$PG_HBA"
sed -i 's/^local\s\+all\s\+all\s\+.*/local   all   all   trust/' "$PG_HBA"
systemctl restart postgresql

# Create user and database
psql -U postgres -c "CREATE USER carei WITH PASSWORD 'CareiDB2026!Secure';" 2>&1 || echo "User may already exist"
psql -U postgres -c "CREATE DATABASE carei OWNER carei;" 2>&1 || echo "Database may already exist"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE carei TO carei;" 2>&1

# Restore proper auth
sed -i 's/^local\s\+all\s\+postgres\s\+trust/local   all   postgres   peer/' "$PG_HBA"
sed -i 's/^local\s\+all\s\+all\s\+trust/local   all   all   peer/' "$PG_HBA"

# Add carei user auth lines
if ! grep -q "carei" "$PG_HBA"; then
  echo "local   carei   carei   md5" >> "$PG_HBA"
  echo "host    carei   carei   127.0.0.1/32   md5" >> "$PG_HBA"
  echo "host    carei   carei   ::1/128        md5" >> "$PG_HBA"
fi

systemctl restart postgresql

echo ""
echo ">>> Testing carei connection..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Database setup complete!"
echo "Connection string: postgresql://carei:CareiDB2026!Secure@127.0.0.1:5432/carei"
