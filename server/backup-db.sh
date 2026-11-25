#!/usr/bin/env bash
# CAREi production database backup.
#
# pg_dump (custom format) from the carei-db container -> ~/backups, then
# best-effort upload to GCS so a copy survives VM loss.
# Local retention: 30 days. GCS retention is enforced by a bucket
# lifecycle rule (90 days) — see BACKUP.md.
#
# Install:  cp server/backup-db.sh ~/backup-db.sh && chmod +x ~/backup-db.sh
# Cron:     0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${HOME}/backups"
BUCKET="gs://carei-db-backups-348910516"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="carei-${STAMP}.dump"

mkdir -p "$BACKUP_DIR"

# Custom-format dump inside the container, then copy out.
docker exec carei-db pg_dump -U carei -d carei -Fc -f "/tmp/${FILE}"
docker cp "carei-db:/tmp/${FILE}" "${BACKUP_DIR}/${FILE}"
docker exec carei-db rm -f "/tmp/${FILE}"

echo "[backup] wrote ${BACKUP_DIR}/${FILE} ($(du -h "${BACKUP_DIR}/${FILE}" | cut -f1))"

# Off-VM copy — failure here must not fail the local backup.
if ! gsutil -q cp "${BACKUP_DIR}/${FILE}" "${BUCKET}/${FILE}"; then
  echo "[backup] WARNING: GCS upload failed for ${FILE}" >&2
fi

# Local rotation: keep 30 days.
find "$BACKUP_DIR" -name 'carei-*.dump' -mtime +30 -delete
