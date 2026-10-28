#!/usr/bin/env bash
# The nightly backup (docs/spec/operations.md section 5.2): dump production,
# upload it, restore it into a throwaway Postgres 17 and verify it with the app
# image's own code, then advance the manifest.
#
#   scripts/backup/nightly.sh <app image>
#
# Needs BACKUP_DATABASE_URL (production, direct URL, the read-only `backup`
# role) and the S3 variables in lib.sh. Optional: BACKUP_BUCKET (default
# finders-eaters-backups), BACKUP_DATE (default today, UTC; tests pin it),
# BACKUP_DOCKER_NETWORK (join an existing Docker network; tests use it).
#
# Bucket layout:
#   daily/<YYYY-MM-DD>.dump    every night (expires after 35 days)
#   daily/<YYYY-MM-DD>.json    that night's manifest, once verified
#   monthly/<YYYY-MM>.dump     the 1st of the month's dump, once verified (400 days)
#   manifest/latest.json       the last verified backup; written last
#
# A dump that fails verification stays in daily/ for diagnosis, the manifest
# is not advanced and the script exits non-zero, which fails the workflow and
# emails the repo owner. Run end to end against local stand-ins by
# scripts/backup/e2e.sh.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

image="${1:?usage: scripts/backup/nightly.sh <app image>}"
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is not set}"
: "${AWS_ENDPOINT_URL_S3:?AWS_ENDPOINT_URL_S3 is not set}"
export BACKUP_DATABASE_URL

date="${BACKUP_DATE:-$(date -u +%F)}"
[[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] || fail "BACKUP_DATE must be YYYY-MM-DD, not $date"
key="daily/$date.dump"
bucket="s3://$BACKUP_BUCKET"

fe_setup fe-backup
verify_db="$fe_run_id-verify"
export VERIFY_DATABASE_URL="postgres://postgres:postgres@$verify_db:5432/finders_eaters"

step "pg_dump production"
fe_pg pg_dump --format=custom --no-owner --no-acl --dbname "$BACKUP_DATABASE_URL" --file /work/backup.dump
size="$(wc -c <"$fe_work/backup.dump" | tr -d ' ')"
echo "dumped $size bytes"

step "upload $bucket/$key"
fe_aws s3 cp --only-show-errors /work/backup.dump "$bucket/$key"

verify_args=(backup verify --date "$date" --object-key "$key" --size-bytes "$size" --out /work/latest.json)

step "previous manifest"
if fe_object_exists manifest/latest.json; then
  fe_aws s3 cp --only-show-errors "$bucket/manifest/latest.json" /work/previous.json
  verify_args+=(--previous /work/previous.json)
  cat "$fe_work/previous.json"
else
  echo "none: this is the first backup"
fi

step "restore into a throwaway pg17"
fe_throwaway_postgres "$verify_db"
fe_pg pg_restore --no-owner --no-acl --exit-on-error --dbname "$VERIFY_DATABASE_URL" /work/backup.dump

step "verify the restore"
if ! fe_app "$image" -e VERIFY_DATABASE_URL -e BACKUP_DATABASE_URL -- "${verify_args[@]}"; then
  fail "the backup $bucket/$key did not verify; it stays in the bucket for diagnosis and manifest/latest.json was not advanced"
fi

if [ "${date:8:2}" = 01 ]; then
  step "first of the month: keep $bucket/monthly/${date:0:7}.dump"
  fe_aws s3 cp --only-show-errors "$bucket/$key" "$bucket/monthly/${date:0:7}.dump"
fi

step "advance the manifest"
fe_aws s3 cp --only-show-errors --content-type application/json /work/latest.json "$bucket/daily/$date.json"
fe_aws s3 cp --only-show-errors --content-type application/json /work/latest.json "$bucket/manifest/latest.json"
cat "$fe_work/latest.json"

printf '\nbackup %s verified\n' "$key"
