#!/usr/bin/env bash
# Tests for scripts/backup/staging-refreshed.sh, the production deploy's
# staging refresh precondition. A local bare repository stands in for GitHub
# and a fake `gh` on PATH serves recorded run JSON, so nothing leaves this
# machine. CI runs it on every PR; run it locally the same way:
#
#   scripts/backup/staging-refreshed.test.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
script="$here/staging-refreshed.sh"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

# Hermetic git: none of the machine's own config (signing, hooks, defaults).
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
git_q() { git -c user.name=test -c user.email=test@example.test "$@"; }

# origin: develop at D (tree T); main at M, a release merge with D's tree;
# develop's older commit O has a different tree.
git_q init -q --bare "$tmp/origin.git"
git_q init -q -b develop "$tmp/src"
echo one >"$tmp/src/file"
git_q -C "$tmp/src" add file
git_q -C "$tmp/src" commit -q -m old
old="$(git -C "$tmp/src" rev-parse HEAD)"
echo two >"$tmp/src/file"
git_q -C "$tmp/src" commit -q -am develop
dev="$(git -C "$tmp/src" rev-parse HEAD)"
main="$(git_q -C "$tmp/src" commit-tree "$dev^{tree}" -p "$old" -p "$dev" -m 'release merge')"
git -C "$tmp/src" branch main "$main"
git -C "$tmp/src" push -q "file://$tmp/origin.git" develop main

# The checkout a deploy runs in: a shallow clone of main only, as
# actions/checkout makes, so develop's commits must be fetched.
git clone -q --depth=1 --branch main "file://$tmp/origin.git" "$tmp/checkout"

mkdir "$tmp/bin" "$tmp/runs"
cat >"$tmp/bin/gh" <<'EOF'
#!/usr/bin/env bash
case "$1 $2" in
  "run list") cat "$FAKE_GH_RUNS/list.json" ;;
  "run view") cat "$FAKE_GH_RUNS/$3.json" ;;
  *) echo "fake gh: unexpected $*" >&2; exit 2 ;;
esac
EOF
chmod +x "$tmp/bin/gh"

# run <id> <sha> <refresh conclusion> <deploy job name> <deploy conclusion>
run() {
  cat >"$tmp/runs/$1.json" <<EOF
{"jobs": [
  {"name": "staging refresh switched on?", "conclusion": "success"},
  {"name": "restore the latest backup into staging", "conclusion": "$3"},
  {"name": "redeploy staging / deploys switched on?", "conclusion": "success"},
  {"name": "redeploy staging / $4", "conclusion": "$5"}
]}
EOF
  printf '{"databaseId": %s, "headSha": "%s"}' "$1" "$2"
}
runs() {
  local IFS=,
  printf '[%s]' "$*" >"$tmp/runs/list.json"
}

check() {
  (cd "$tmp/checkout" && PATH="$tmp/bin:$PATH" FAKE_GH_RUNS="$tmp/runs" "$script") >"$tmp/out.log" 2>&1
}
passes() {
  check || { cat "$tmp/out.log"; fail "$1: expected the deploy to go on"; }
  echo "ok: $1"
}
refuses() {
  if check; then
    cat "$tmp/out.log"
    fail "$1: expected the deploy to stop"
  fi
  grep -q "$2" "$tmp/out.log" || { cat "$tmp/out.log"; fail "$1: the error did not say '$2'"; }
  echo "ok: $1"
}

deployed="deploy finders-eaters-staging"
skipped='deploy ${{ inputs.app }}'

runs "$(run 1 "$dev" success "$deployed" success)"
passes "a refresh that restored and redeployed this tree"

runs "$(run 2 "$dev" skipped "$skipped" skipped)"
refuses "a refresh run whose gate was off" "restored and redeployed"

runs "$(run 3 "$dev" success "$skipped" skipped)"
refuses "a refresh whose redeploy was skipped (no staging deploy token)" "restored and redeployed"

runs "$(run 4 "$dev" success "$deployed" failure)"
refuses "a refresh whose redeploy failed" "restored and redeployed"

runs "$(run 5 "$dev" skipped "$skipped" skipped)" "$(run 6 "$dev" success "$deployed" success)"
passes "a later empty run does not hide an earlier real refresh of this tree"

runs "$(run 7 "$old" success "$deployed" success)"
refuses "a refresh of another tree" "merge main into develop"

runs
refuses "no refresh runs at all" "No staging refresh restored and redeployed"

printf '\nstaging-refreshed tests passed\n'
