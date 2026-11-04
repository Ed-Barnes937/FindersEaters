# shellcheck shell=bash
# Shared by scripts/backup/*.sh (docs/spec/operations.md sections 5 and 6).
# Sourced, not run.
#
# Every tool runs in a pinned container, so a GitHub runner and a laptop use
# the same Postgres 17 client tools and the same AWS CLI, and nothing needs
# installing. The containers share one Docker network (fe_net), which reaches
# the internet for the real database and bucket, and, in scripts/backup/e2e.sh,
# the local stand-ins for them.
#
# S3 settings come from the standard AWS CLI variables: AWS_ACCESS_KEY_ID,
# AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3 (Tigris:
# https://fly.storage.tigris.dev) and AWS_REGION (Tigris: auto).

PG_IMAGE=pgvector/pgvector:pg17
AWS_IMAGE=amazon/aws-cli:2.39.0
BACKUP_BUCKET="${BACKUP_BUCKET:-finders-eaters-backups}"

step() { printf '\n== %s\n' "$*"; }
fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

# fe_setup <prefix>: a work directory (mounted at /work in every container)
# and the Docker network. Pass BACKUP_DOCKER_NETWORK to join an existing one.
fe_setup() {
  fe_run_id="$1-$$"
  fe_work="$(mktemp -d)"
  chmod 755 "$fe_work"
  if [ -n "${BACKUP_DOCKER_NETWORK:-}" ]; then
    fe_net="$BACKUP_DOCKER_NETWORK"
    fe_own_net=false
  else
    fe_net="$fe_run_id"
    fe_own_net=true
    docker network create "$fe_net" >/dev/null
  fi
  fe_containers=()
  trap fe_cleanup EXIT
}

fe_cleanup() {
  if [ "${#fe_containers[@]}" -gt 0 ]; then
    docker rm -f "${fe_containers[@]}" >/dev/null 2>&1 || true
  fi
  if [ "$fe_own_net" = true ]; then docker network rm "$fe_net" >/dev/null 2>&1 || true; fi
  rm -rf "$fe_work"
}

# Runs as the calling user so files written to /work stay removable.
fe_docker() {
  docker run --rm --network "$fe_net" -v "$fe_work:/work" -w /work \
    --user "$(id -u):$(id -g)" "$@"
}

# fe_pg <tool> <args...>: a Postgres 17 client tool (pg_dump, pg_restore, psql).
fe_pg() {
  fe_docker -i -e PGCONNECT_TIMEOUT=30 "$PG_IMAGE" "$@"
}

# fe_aws <args...>: the AWS CLI against the bucket's S3 endpoint.
fe_aws() {
  fe_docker -e HOME=/tmp \
    -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY -e AWS_ENDPOINT_URL_S3 \
    -e AWS_REGION="${AWS_REGION:-auto}" \
    "$AWS_IMAGE" "$@"
}

# fe_app <image> <env args...> -- <cli args...>: the app image's operator CLI
# (node apps/server/src/cli.ts), so checks run with exactly the code the
# image deploys.
fe_app() {
  local image="$1"
  shift
  local docker_args=(--init)
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    docker_args+=("$1")
    shift
  done
  [ "$#" -gt 0 ] || fail "fe_app: missing -- before the CLI arguments"
  shift
  fe_docker "${docker_args[@]}" "$image" node /app/apps/server/src/cli.ts "$@"
}

# fe_object_exists <key>: 0 if it exists, 1 if not; any other error fails.
fe_object_exists() {
  local err="$fe_work/head-object.err"
  if fe_aws s3api head-object --bucket "$BACKUP_BUCKET" --key "$1" >/dev/null 2>"$err"; then
    return 0
  fi
  if grep -q '(404)' "$err"; then return 1; fi
  cat "$err" >&2
  fail "could not check s3://$BACKUP_BUCKET/$1"
}

# fe_throwaway_postgres <name>: a fresh pgvector/pgvector:pg17 container on the
# network, waited on until healthy. The check goes over TCP: the image's
# first-start initdb server answers on the socket only, then restarts, so a
# socket check can pass before the real server is up. Its URL is postgres://postgres:postgres@<name>:5432/finders_eaters.
fe_throwaway_postgres() {
  local name="$1"
  docker run -d --name "$name" --network "$fe_net" \
    -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=finders_eaters \
    --health-cmd 'pg_isready -h 127.0.0.1 -U postgres -d finders_eaters' --health-interval 1s --health-retries 60 \
    "$PG_IMAGE" >/dev/null
  fe_containers+=("$name")
  for _ in $(seq 60); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' "$name")" = healthy ] && return 0
    sleep 1
  done
  fail "Postgres container $name did not become healthy"
}
