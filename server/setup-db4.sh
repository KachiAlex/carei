#!/bin/bash
set -e

PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
PGPORT=5433

echo ">>> Current state - pg_hba.conf:"
grep -v "^#" "$PG_HBA" | grep -v "^$"

echo ""
echo ">>> Temporarily set trust auth..."
cp "$PG_HBA" "${PG_HBA}.bak2"
# Remove carei-specific lines
sed -i '/carei/d' "$PG_HBA"
# Set trust for local
sed -i 's/^local\s\+all\s\+postgres\s\+\(peer\|md5\|trust\)/local   all   postgres   trust/' "$PG_HBA"
sed -i 's/^local\s\+all\s\+all\s\+\(peer\|md5\|trust\)/local   all   all   trust/' "$PG_HBA"

systemctl restart postgresql

echo ">>> Fixing carei user password..."
psql -U postgres -p $PGPORT -c "ALTER USER carei WITH PASSWORD 'CareiDB2026!Secure';" 2>&1

echo ">>> Ensuring carei database exists..."
psql -U postgres -p $PGPORT -c "SELECT datname FROM pg_database WHERE datname='carei';" 2>&1

echo ">>> Granting privileges..."
psql -U postgres -p $PGPORT -c "GRANT ALL PRIVILEGES ON DATABASE carei TO carei;" 2>&1

echo ""
echo ">>> Testing connection..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p $PGPORT -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Restoring pg_hba.conf and adding carei rules..."
cp "${PG_HBA}.bak2" "$PG_HBA"

# Add carei auth with scram-sha-256
echo "local   carei   carei   scram-sha-256" >> "$PG_HBA"
echo "host    carei   carei   127.0.0.1/32   scram-sha-256" >> "$PG_HBA"
echo "host    carei   carei   ::1/128        scram-sha-256" >> "$PG_HBA"

systemctl restart postgresql

echo ""
echo ">>> Final test with restored auth..."
PGPASSWORD='CareiDB2026!Secure' psql -U carei -d carei -h 127.0.0.1 -p $PGPORT -c "SELECT current_user, current_database();" 2>&1

echo ""
echo ">>> Done! Connection string: postgresql://carei:CareiDB2026!Secure@127.0.0.1:5433/carei"
