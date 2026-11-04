# Shared by the fakes. `provision.sh --dry-run` puts this directory first on
# PATH, so fly, gh, neonctl, psql, aws, curl and the browser opener are these
# scripts: they keep a pretend world under $PROVISION_FAKE_STATE/fake and log
# every call to $PROVISION_FAKE_STATE/calls.log. Nothing here reaches a
# network or a real account.
# shellcheck shell=bash
set -euo pipefail

: "${PROVISION_FAKE_STATE:?the fakes run only under provision.sh --dry-run}"
F="$PROVISION_FAKE_STATE/fake"
mkdir -p "$F"
args="$*"
call="$(basename "$0") ${args//$'\n'/ }"
printf '%s\n' "$call" >>"$PROVISION_FAKE_STATE/calls.log"

# PROVISION_FAKE_FAIL: a regex; a call matching it fails, as a real CLI might.
if [[ -n "${PROVISION_FAKE_FAIL:-}" && "$call" =~ $PROVISION_FAKE_FAIL ]]; then
  printf 'fake %s: failing on request\n' "$(basename "$0")" >&2
  exit 1
fi

# put PATH VALUE / get PATH / has PATH: the fake world's files.
put() {
  mkdir -p "$(dirname "$F/$1")"
  printf '%s' "$2" >"$F/$1"
}
get() { cat "$F/$1"; }
has() { [[ -e "$F/$1" ]]; }

# names DIR: a JSON array of {"name": file} for every file in DIR.
names() {
  if [[ -d "$F/$1" ]]; then
    find "$F/$1" -mindepth 1 -maxdepth 1 -exec basename {} \; | sort | jq -R '{name: .}' | jq -s .
  else
    echo '[]'
  fi
}

# opt FLAG ARGS...: the value after FLAG, if given.
opt() {
  local flag="$1"
  shift
  while (($#)); do
    if [[ "$1" == "$flag" ]]; then
      printf '%s' "${2:-}"
      return 0
    fi
    shift
  done
  return 1
}

die() {
  printf 'fake %s: %s\n' "$(basename "$0")" "$*" >&2
  exit 1
}
