#!/usr/bin/env bash
# The nightly backup and the staging refresh, end to end, on local Docker only
# (docs/spec/operations.md sections 5.2 and 6). Stand-ins: a Postgres 17
# container for production, another for staging, and RustFS for the Tigris
# bucket (an S3-compatible store; the AWS CLI talks to it exactly as it talks
# to Tigris). CI runs it on every PR; run it locally the same way:
#
#   docker build -t finders-eaters:local . && scripts/backup/e2e.sh finders-eaters:local
#
# It proves: a first backup verifies and writes the manifest; the 1st of the
# month is kept under monthly/; lifecycle rules are accepted; a backup with
# fewer households than the last, or a migration history main does not ship,
# fails loudly, stays in the bucket and leaves the manifest alone; a staging
# refresh replaces staging with the latest backup and the release step then
# runs on it; a stale backup refuses to refresh and leaves staging alone.
#
# Touches nothing outside this machine's Docker.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
. "$(dirname "$0")/lib.sh"

image="${1:?usage: scripts/backup/e2e.sh <app image>}"

fe_setup fe-backup-e2e
s3="$fe_run_id-s3"
prod="$fe_run_id-prod"
staging="$fe_run_id-staging"
prod_url="postgres://postgres:postgres@$prod:5432/finders_eaters"
staging_url="postgres://postgres:postgres@$staging:5432/finders_eaters"

export BACKUP_DOCKER_NETWORK="$fe_net"
export AWS_ACCESS_KEY_ID=e2e-access-key
export AWS_SECRET_ACCESS_KEY=e2e-secret-key-not-real
export AWS_ENDPOINT_URL_S3="http://$s3:9000"
export AWS_REGION=auto
export BACKUP_BUCKET=finders-eaters-backups
export BACKUP_DATABASE_URL="$prod_url"
export STAGING_DATABASE_URL_DIRECT="$staging_url"

sql() { fe_pg psql --no-psqlrc -v ON_ERROR_STOP=1 -tAq --dbname "$1" -c "$2"; }
expect_eq() {
  [ "$2" = "$3" ] || fail "$1: expected '$3', got '$2'"
  echo "ok: $1"
}
manifest_field() {
  fe_aws s3 cp --only-show-errors "s3://$BACKUP_BUCKET/manifest/latest.json" /work/check.json
  jq -r "$1" "$fe_work/check.json"
}
release_on() {
  fe_app "$image" -e DATABASE_URL_DIRECT="$1" -- release
}
add_household() {
  fe_app "$image" -e DATABASE_URL="$1" \
    -e BETTER_AUTH_SECRET=e2e-only-secret-long-enough-for-better-auth \
    -e BETTER_AUTH_URL=http://localhost:8080 -- \
    household create --name "$2" --email "$3" --user-name E2E >/dev/null
}
nightly() { BACKUP_DATE="$1" "$here/nightly.sh" "$image"; }

step "stand-ins: S3 store, production and staging Postgres"
docker run -d --name "$s3" --network "$fe_net" \
  -e RUSTFS_ACCESS_KEY="$AWS_ACCESS_KEY_ID" -e RUSTFS_SECRET_KEY="$AWS_SECRET_ACCESS_KEY" \
  rustfs/rustfs:1.0.4 /data >/dev/null
fe_containers+=("$s3")
fe_throwaway_postgres "$prod"
fe_throwaway_postgres "$staging"
s3_up=false
for _ in $(seq 30); do
  fe_aws s3 ls >/dev/null 2>&1 && s3_up=true && break
  sleep 1
done
[ "$s3_up" = true ] || fail "the RustFS S3 store did not answer within 30 seconds"
fe_aws s3 mb "s3://$BACKUP_BUCKET"
cp "$here/lifecycle.json" "$fe_work/lifecycle.json"
fe_aws s3api put-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET" \
  --lifecycle-configuration file:///work/lifecycle.json
expect_eq "lifecycle rules applied" \
  "$(fe_aws s3api get-bucket-lifecycle-configuration --bucket "$BACKUP_BUCKET" \
    --query 'sort_by(Rules,&ID)[].[ID,Filter.Prefix,Expiration.Days]' --output text | tr '\t\n' ' ')" \
  "daily-35-days daily/ 35 monthly-400-days monthly/ 400 "

step "production: migrated, one household"
release_on "$prod_url" >/dev/null
add_household "$prod_url" "Prod one" one@example.test

step "first backup, on the 1st of the month"
nightly 2026-10-01
expect_eq "manifest date" "$(manifest_field .date)" 2026-10-01
expect_eq "manifest households" "$(manifest_field '.rowCounts["public.household"]')" 1
expect_eq "monthly copy kept" \
  "$(fe_aws s3 ls "s3://$BACKUP_BUCKET/monthly/" | awk '{print $4}')" 2026-10.dump

step "second backup, a household more"
add_household "$prod_url" "Prod two" two@example.test
nightly 2026-10-02
expect_eq "manifest date" "$(manifest_field .date)" 2026-10-02
expect_eq "manifest households" "$(manifest_field '.rowCounts["public.household"]')" 2
expect_eq "no monthly copy on the 2nd" \
  "$(fe_aws s3 ls "s3://$BACKUP_BUCKET/monthly/" | awk '{print $4}')" 2026-10.dump

step "a backup with fewer households than the last fails loudly"
sql "$prod_url" "delete from household where name = 'Prod two'"
if nightly 2026-10-03 >"$fe_work/fewer.log" 2>&1; then
  cat "$fe_work/fewer.log"
  fail "a backup with fewer households than the previous one verified"
fi
grep -q 'public.household has 1 row, fewer than the 2 in the previous backup' "$fe_work/fewer.log" ||
  { cat "$fe_work/fewer.log"; fail "the failure did not name the shrunken table"; }
expect_eq "manifest not advanced" "$(manifest_field .date)" 2026-10-02
fe_object_exists daily/2026-10-03.dump || fail "the failed dump was not kept for diagnosis"
echo "ok: failed dump kept for diagnosis"

step "a migration history main does not ship fails loudly"
add_household "$prod_url" "Prod two again" two-again@example.test
sql "$prod_url" "insert into drizzle.__drizzle_migrations (hash, created_at) values (repeat('e', 64), 99999999999999)"
if nightly 2026-10-04 >"$fe_work/history.log" 2>&1; then
  cat "$fe_work/history.log"
  fail "a backup with an unknown migration verified"
fi
grep -q 'is not one this build ships' "$fe_work/history.log" ||
  { cat "$fe_work/history.log"; fail "the failure did not name the migration history"; }
expect_eq "manifest not advanced" "$(manifest_field .date)" 2026-10-02
sql "$prod_url" "delete from drizzle.__drizzle_migrations where hash = repeat('e', 64)"

step "staging: migrated, holding its own junk"
release_on "$staging_url" >/dev/null
add_household "$staging_url" "Staging junk" junk@example.test

step "staging refresh replaces staging with the latest verified backup"
"$here/staging-refresh.sh" "$image"
expect_eq "staging households are the 2026-10-02 backup's" \
  "$(sql "$staging_url" "select string_agg(name, ',' order by name) from household")" "Prod one,Prod two"
step "the redeploy's release step runs on the refreshed staging"
release_on "$staging_url" | tee "$fe_work/release.log"
grep -q 'release: done' "$fe_work/release.log" || fail "the release step did not finish on refreshed staging"

step "a stale backup refuses to refresh and leaves staging alone"
sql "$staging_url" "update household set name = 'Touched by e2e' where name = 'Prod one'"
if REFRESH_MAX_AGE_HOURS=0.0001 "$here/staging-refresh.sh" "$image" >"$fe_work/stale.log" 2>&1; then
  cat "$fe_work/stale.log"
  fail "a stale backup refreshed staging"
fi
grep -q 'hour limit' "$fe_work/stale.log" || { cat "$fe_work/stale.log"; fail "the failure did not say the backup is stale"; }
expect_eq "staging untouched" \
  "$(sql "$staging_url" "select count(*) from household where name = 'Touched by e2e'")" 1

printf '\nbackup e2e passed\n'
