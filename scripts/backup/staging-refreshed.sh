#!/usr/bin/env bash
# The production deploy's staging refresh precondition
# (docs/spec/operations.md section 6), run by deploy.yml's "Staging refreshed"
# step in the checkout of the main commit being deployed:
#
#   scripts/backup/staging-refreshed.sh
#
# Passes only if a run of staging-refresh.yml on develop, at a commit with
# exactly this commit's git tree, both restored the latest backup into staging
# and redeployed staging. A run's own conclusion is not enough: a run whose
# gate was off, or whose redeploy was skipped for want of a deploy token,
# also ends as `success` having done nothing, so this checks the two jobs that
# do the work.
#
# Needs `gh` (with GH_TOKEN, actions: read), `jq` and an `origin` remote to
# fetch develop's commits from. Tested by scripts/backup/staging-refreshed.test.sh.
set -euo pipefail

# The job names in staging-refresh.yml. A called workflow's jobs are named
# "<caller job> / <job>", and deploy.yml names its deploy job after the app.
refresh_job="restore the latest backup into staging"
redeploy_job="redeploy staging / deploy finders-eaters-staging"

tree="$(git rev-parse 'HEAD^{tree}')"
head="$(git rev-parse HEAD)"

runs="$(gh run list --workflow staging-refresh.yml --branch develop --status success \
  --limit 20 --json databaseId,headSha | jq -r '.[] | "\(.databaseId) \(.headSha)"')"

same_tree=false
while read -r id sha; do
  [ -n "$id" ] || continue
  git cat-file -e "$sha^{commit}" 2>/dev/null ||
    git fetch --quiet --no-tags --depth=1 origin "$sha"
  [ "$(git rev-parse "$sha^{tree}")" = "$tree" ] || continue
  same_tree=true
  if gh run view "$id" --json jobs | jq -e --arg refresh "$refresh_job" --arg redeploy "$redeploy_job" '
      [.jobs[] | select(.conclusion == "success") | .name] as $done
      | ($done | index($refresh)) != null and ($done | index($redeploy)) != null
    ' >/dev/null; then
    echo "Staging was restored from the latest backup and redeployed at $sha (run $id), the same tree as $head."
    exit 0
  fi
  echo "Run $id at $sha has this tree but did not both restore and redeploy staging (switched off, or the redeploy was skipped); not counting it."
done <<<"$runs"

if [ "$same_tree" = true ]; then
  echo "::error::No staging refresh restored and redeployed this tree: the refresh runs on it were switched off or skipped the redeploy. Switch the staging refresh and staging deploys on, run 'Staging refresh' on develop at the commit being released, check staging, then re-run this deploy (docs/runbooks/backup-and-restore.md)."
else
  echo "::error::No staging refresh restored and redeployed this tree. Run 'Staging refresh' on develop at the commit being released, check staging, then re-run this deploy. If main has commits develop lacks (docs committed straight to main), no develop commit can have this tree: merge main into develop, refresh staging there, and release again (docs/runbooks/backup-and-restore.md)."
fi
exit 1
