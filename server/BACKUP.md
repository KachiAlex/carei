# Database backup & restore

Production Postgres (`carei-db` container, docker volume `server_carei_pgdata`) on GCE VM `carei-api` (34.89.105.163, europe-west2-a).

## Automated backups

`server/backup-db.sh` runs daily at 03:00 UTC via cron on the VM:

```
0 3 * * * /home/ubuntu/backup-db.sh >> /home/ubuntu/backups/backup.log 2>&1
```

- Writes `~/backups/carei-<timestamp>.dump` (pg_dump custom format), 30-day local retention
- **VM-loss protection**: daily disk snapshot schedule `carei-daily-snap`
  (02:00, 14-day retention, snapshots kept on disk delete) attached to the
  `carei-api` boot disk — covers the whole postgres volume.
- The script also attempts a GCS upload to `gs://carei-db-backups-348910516`
  (bucket exists, 90-day lifecycle). It currently warns + skips because the
  VM's access scopes lack `devstorage` — to enable, add the
  `https://www.googleapis.com/auth/devstorage.read_write` scope to the
  `carei-api` instance (requires a brief stop) and the upload starts working
  with no other change.

## Manual backup

```bash
ssh ubuntu@carei-api
~/backup-db.sh
```

## Restore procedure

```bash
# 1. Pick a dump (local or from GCS)
gsutil cp gs://carei-db-backups-348910516/carei-<timestamp>.dump ~/restore.dump

# 2. Copy into the container and restore
docker cp ~/restore.dump carei-db:/tmp/restore.dump

# Full rebuild (DESTROYS current data — stop the API first):
docker compose -f ~/server/docker-compose.yml stop api
docker exec carei-db psql -U carei -d carei -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
docker exec carei-db pg_restore -U carei -d carei --no-owner --no-acl /tmp/restore.dump
docker compose -f ~/server/docker-compose.yml start api

# 3. Verify
curl https://api.careiapp.com/health
```

## Restore drill (non-destructive verification)

**Verified 2026-11-25**: `carei-20261125-113637.dump` restored into
`carei_restore_test` — 31/31 users, 26/26 visits, zero errors. To re-verify:

```bash
docker cp ~/backups/<latest>.dump carei-db:/tmp/r.dump
docker exec carei-db createdb -U carei carei_restore_test
docker exec carei-db pg_restore -U carei -d carei_restore_test --no-owner --no-acl /tmp/r.dump
docker exec carei-db psql -U carei -d carei_restore_test -c 'SELECT count(*) FROM users'
docker exec carei-db dropdb -U carei carei_restore_test
```
