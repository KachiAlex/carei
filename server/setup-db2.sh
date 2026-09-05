#!/bin/bash
set -e

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
PG_CONF="/etc/postgresql/16/main/postgresql.conf"

echo ">>> Current port setting:"
grep "^port" "$PG_CONF" || echo "Default port (5432)"

echo ""
echo ">>> Fixing pg_hba.conf for carei user..."

# Remove any existing carei lines
sed -i '/carei/d' "$PG_HBA"

# Add carei auth with scram-sha-256 to match existing auth style
echo "local   carei   carei   scram-sha-256" >> "$PG_HBA"
echo "host    carei   carei   127.0.0.1/32   scram-sha-256" >> "$PG_HBA"
echo "host    carei   carei   ::1/128        scram-sha-256" >> "$PG_HBA"

# Set the password using scram-sha-256 encryption
# First temporarily allow trust for postgres
sed -i 's/^local\s\+all\s\+postgres\s\+md5/local   all   postgres   trust/' "$PG_HBA"
systemctl restart postgresql

# Reset carei password with proper encryption
psql -U postgres -c "ALTER USER carei WITH PASSWORD 'CareiDB2026!Secure';" 2>&1

# Restore postgres auth
sed -i 's/^local\s\+all\s\+postgres\s\+trust/local   all   postgres   md5/' "$PG_HBA"
systemctl restart postgresql

echo ""
echo ">>> Checking PostgreSQL port..."
PGPORT=$(grep "^port" "$PG_CONF" | awk '{print $3}')
if [ -z "$PGPORT" ]; then PGPORT=5432; fi
echo "PostgreSQL port: $PGPORT"

echo ""
echo ">>> Testing carei connection on port $PGPORT..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p $PGPORT -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Database setup complete!"
echo "Connection string: postgresql://carei:CareiDB2026!Secure@127.0.0.1:$PGPORT/carei"
