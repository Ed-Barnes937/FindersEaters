#!/usr/bin/env bash
# The staging data refresh (docs/spec/operations.md section 6), steps 1 and 2:
# fail if the latest verified backup is too old, then replace every app schema
# on the staging database with that backup. The workflow then redeploys
# staging, whose release step applies develop's migrations and KB load and
# prints the staleness report (steps 3 and 4).
#
#   scripts/backup/staging-refresh.sh <app image>
#
# Needs STAGING_DATABASE_URL_DIRECT (the staging branch, direct URL) and the S3
# variables in lib.sh. Optional: BACKUP_BUCKET, REFRESH_MAX_AGE_HOURS (default
# 36), BACKUP_DOCKER_NETWORK.
#
# The drop and the restore run in one transaction, so a failed refresh leaves
# staging exactly as it was. Run end to end against local stand-ins by
# scripts/backup/e2e.sh.
set -euo pipefail
. "$(dirname "$0")/lib.sh"

image="${1:?usage: scripts/backup/staging-refresh.sh <app image>}"
: "${STAGING_DATABASE_URL_DIRECT:?STAGING_DATABASE_URL_DIRECT is not set}"
: "${AWS_ENDPOINT_URL_S3:?AWS_ENDPOINT_URL_S3 is not set}"
max_age="${REFRESH_MAX_AGE_HOURS:-36}"
bucket="s3://$BACKUP_BUCKET"

# The schemas the app owns (operations.md section 6). `public` is recreated
# empty because pg_dump never emits CREATE SCHEMA public; the dump recreates
# the rest, and any extension the dump needs.
app_schemas="public, kb, drizzle, ops"

fe_setup fe-refresh

step "latest verified backup"
fe_object_exists manifest/latest.json || fail "there is no verified backup yet ($bucket/manifest/latest.json); run the nightly backup first"
fe_aws s3 cp --only-show-errors "$bucket/manifest/latest.json" /work/latest.json
cat "$fe_work/latest.json"
if ! key="$(fe_app "$image" -- backup fresh --manifest /work/latest.json --max-age-hours "$max_age")"; then
  fail "the latest verified backup is older than $max_age hours, so the nightly backup is failing or switched off; staging was not touched"
fi
echo "refreshing from $key"

step "download $bucket/$key"
fe_aws s3 cp --only-show-errors "$bucket/$key" /work/backup.dump

step "replace staging's app schemas with the backup, in one transaction"
# The whole script is written out first, so a pg_restore failure can never
# hand psql a truncated script that commits half a restore.
fe_pg pg_restore --no-owner --no-acl --file /work/restore.sql /work/backup.dump
{
  echo "set client_min_messages = warning;"
  echo "drop schema if exists $app_schemas cascade;"
  echo "create schema public;"
  cat "$fe_work/restore.sql"
} >"$fe_work/refresh.sql"
fe_pg psql --quiet --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction \
  --dbname "$STAGING_DATABASE_URL_DIRECT" --file /work/refresh.sql >/dev/null

printf '\nstaging restored from %s\n' "$key"
