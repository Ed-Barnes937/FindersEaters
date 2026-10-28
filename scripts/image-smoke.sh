#!/usr/bin/env bash
# Proves a built image deploys from empty, entirely on local Docker
# (docs/spec/operations.md section 3.1): a fresh pgvector/pgvector:pg17
# container, the release step twice (applies from empty, then is a no-op), a
# release that must fail against an unreachable database, then the server
# itself answering /health with its database round-trip. CI runs it on every
# PR; run it locally the same way:
#
#   docker build -t finders-eaters:local . && scripts/image-smoke.sh finders-eaters:local
#
# Touches nothing outside this machine's Docker.
set -euo pipefail

image="${1:?usage: scripts/image-smoke.sh <image>}"
run_id="fe-smoke-$$"
network="$run_id"
db="$run_id-db"
app="$run_id-app"
port="${SMOKE_PORT:-18080}"
url="postgres://postgres:postgres@$db:5432/finders_eaters"

cleanup() {
  docker rm -f "$app" "$db" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

step() { printf '\n== %s\n' "$*"; }
fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

step "fresh Postgres"
docker network create "$network" >/dev/null
docker run -d --name "$db" --network "$network" \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finders_eaters \
  --health-cmd 'pg_isready -U postgres -d finders_eaters' --health-interval 1s --health-retries 60 \
  pgvector/pgvector:pg17 >/dev/null
for _ in $(seq 60); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$db")" = healthy ] && break
  sleep 1
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$db")" = healthy ] || fail "Postgres did not become healthy"

release() {
  docker run --rm --network "$network" -e DATABASE_URL_DIRECT="$1" "$image" \
    node apps/server/src/cli.ts release
}

step "release step from empty"
release "$url"

step "release step again (idempotent)"
release "$url"

step "release step against an unreachable database must fail"
if release "postgres://postgres:postgres@$run_id-nowhere:5432/none"; then
  fail "the release step exited 0 without a database, so a failed release would not abort a deploy"
fi
echo "failed as it should"

step "server /health"
docker run -d --name "$app" --network "$network" -p "127.0.0.1:$port:8080" \
  -e DATABASE_URL="$url" "$image" >/dev/null
body=""
for _ in $(seq 30); do
  if body="$(curl -fsS --max-time 5 "http://127.0.0.1:$port/health" 2>/dev/null)"; then break; fi
  sleep 1
done
[ -n "$body" ] || {
  docker logs "$app" >&2
  fail "/health never answered 200"
}
echo "$body"
case "$body" in
  *'"status":"ok"'*'"ok":true'*) ;;
  *) fail "/health did not report a healthy database round-trip" ;;
esac

step "server serves the SPA shell"
curl -fsS --max-time 5 "http://127.0.0.1:$port/" | grep -q '<div id="root">' ||
  fail "the SPA shell was not served"

printf '\nimage smoke passed\n'
