# Backup, restore and staging refresh

How production's data is backed up, how to get it back, and how staging is refreshed from it. The design is `docs/spec/operations.md` sections 5 and 6; this is the operating manual for it.

## What exists in the repo

| File | What it does |
| --- | --- |
| `.github/workflows/backup.yml` | **Nightly backup**, 03:15 UTC (and by hand): builds `main`'s image, then runs `scripts/backup/nightly.sh`. |
| `.github/workflows/staging-refresh.yml` | **Staging refresh**, by hand on `develop`: `scripts/backup/staging-refresh.sh`, then redeploys staging through `deploy.yml`. |
| `.github/workflows/deploy.yml`, "Staging refreshed" step | Production deploys stop unless a successful staging refresh ran on a `develop` commit with the same tree as the `main` commit being deployed. |
| `scripts/backup/nightly.sh` | `pg_dump` production, upload, restore into a throwaway `pgvector/pgvector:pg17`, verify with the app image, advance the manifest. |
| `scripts/backup/staging-refresh.sh` | Freshness check (36 hours), then drop staging's app schemas and restore the latest verified dump, in one transaction. |
| `node apps/server/src/cli.ts backup verify` / `backup fresh` | The checks both scripts call, in the app image (`apps/server/src/backup/`). |
| `scripts/backup/lifecycle.json` | The bucket's lifecycle rules: `daily/` 35 days, `monthly/` 400 days. |
| `scripts/backup/e2e.sh` | Everything above end to end on local Docker, with RustFS standing in for Tigris. CI runs it on every PR. |

Every tool runs in a pinned container (`pgvector/pgvector:pg17` for the Postgres 17 client tools, `amazon/aws-cli` for S3), so a runner and a laptop behave the same.

### The bucket

`finders-eaters-backups` on Tigris, private.

| Key | What | Kept |
| --- | --- | --- |
| `daily/<YYYY-MM-DD>.dump` | that night's `pg_dump --format=custom --no-owner --no-acl`, uploaded before verification | 35 days |
| `daily/<YYYY-MM-DD>.json` | that night's manifest, written only if it verified | 35 days |
| `monthly/<YYYY-MM>.dump` | the 1st of the month's dump, copied only if it verified | 400 days |
| `manifest/latest.json` | the last verified backup; written last, so it only ever names a verified dump | always |

A manifest holds the date, when it verified, the object key, the size, row counts per durable table, the dump's migration count and head hash, and the KB version (null until the KB load lands).

### What "verified" means

`backup verify` fails, listing every problem, unless:

1. `pg_restore --exit-on-error` restored the dump into a fresh pg17;
2. there is at least one household, and no table marked `never-shrinks` in `packages/db/src/backup.ts` has fewer rows than in the previous manifest (today that is `household`; recipes join when they exist);
3. the restored migration history equals production's, and is a prefix of the migrations `main` ships;
4. `main`'s release step runs cleanly against the restore;
5. the `/health` query then reports every migration `main` ships.

A failure fails the workflow (GitHub emails the owner), leaves the dump in `daily/` for diagnosis, and does not advance `manifest/latest.json`. Every new table must be classified in `BACKUP_TABLES`, or a test fails.

## Off until the owner turns it on

Both workflows run, but their `gate` job stops with a notice (the run passes) until the owner sets the switches. The production precondition only runs once production deploys are on. Nothing creates, changes or pays for infrastructure until the owner does the steps below.

### Owner checklist (real infrastructure, costs money)

1. **Neon `backup` role.** In the Neon console create a role `backup` on the production branch, then as the owner role: `grant pg_read_all_data to backup;`. Check it can read but not write: `psql "<backup direct URL>" -c 'select count(*) from household'` works and `-c 'create table x(i int)'` fails.
2. **Tigris bucket.** `fly storage create --name finders-eaters-backups` (private). Make an access key scoped to this bucket only (Tigris console, Access Keys, Editor on this bucket).
3. **Lifecycle rules.** With that key in the environment: `aws s3api put-bucket-lifecycle-configuration --endpoint-url https://fly.storage.tigris.dev --bucket finders-eaters-backups --lifecycle-configuration file://scripts/backup/lifecycle.json`, then `get-bucket-lifecycle-configuration` to check.
4. **GitHub secrets**: `BACKUP_DATABASE_URL` (the `backup` role, production's **direct** URL), `TIGRIS_BACKUP_ACCESS_KEY_ID`, `TIGRIS_BACKUP_SECRET_ACCESS_KEY`, `STAGING_DATABASE_URL_DIRECT` (the staging branch's direct URL, owner role).
5. **Switch the backup on** once `main` holds this code (after the first release that includes it): repository variable `BACKUP_ENABLED=true`, then run **Nightly backup** by hand from the Actions tab. Check the log ends `backup daily/<date>.dump verified`, and `manifest/latest.json` exists.
6. **Switch the staging refresh on** once staging deploys are on (`docs/runbooks/deploy.md`) and a backup has verified: repository variable `STAGING_REFRESH_ENABLED=true`, then run **Staging refresh** on `develop`. Check the log says `staging restored from daily/<date>.dump` and the redeploy's release step finished.

To turn either off, delete the variable or set it to anything but `true`.

## Before every release

1. Run **Staging refresh** on `develop` at the commit you are about to release. It fails if the last verified backup is more than 36 hours old: then the nightly backup is broken, and that comes first.
2. Check staging: the redeploy's log has `release: done` and the staleness report; open the app on staging.
3. Merge the release PR. The production deploy's "Staging refreshed" step finds that refresh run by tree and lets the deploy go on. If `develop` moved since, refresh again.

## Restore runbooks

### Undo something recent (within 7 days)

Neon's restore window covers this; no backup file is needed.

1. In Neon, create a branch from production at a timestamp just before the damage. Inspect it with `psql`.
2. If the whole database should go back: Neon's branch restore resets production to that point (Neon keeps a backup branch of the pre-restore state). If only some rows were damaged: copy them across with `psql` from the inspection branch.
3. Delete the inspection branch.

### Neon is gone, or move off Neon

1. Create a Postgres 17 database with pgvector available (a new Neon project, or Fly Managed Postgres, which is the ADR's upgrade path).
2. Download the latest verified dump:
   ```sh
   export AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev AWS_REGION=auto   # plus the backup key pair
   aws s3 cp s3://finders-eaters-backups/manifest/latest.json - | grep objectKey
   aws s3 cp s3://finders-eaters-backups/<objectKey> backup.dump
   ```
3. Restore it with Postgres 17 client tools:
   ```sh
   pg_restore --no-owner --no-acl --exit-on-error --dbname "<new direct URL>" backup.dump
   ```
   No local Postgres 17? `docker run --rm -v "$PWD:/work" pgvector/pgvector:pg17 pg_restore --no-owner --no-acl --exit-on-error --dbname "<new direct URL>" /work/backup.dump`.
4. Set `DATABASE_URL` and `DATABASE_URL_DIRECT` on the Fly app (`fly secrets set -a finders-eaters ...`), then redeploy, so the release step migrates and loads the KB if needed.
5. Repoint `BACKUP_DATABASE_URL` (and create the `backup` role again) and the staging branch / `STAGING_DATABASE_URL_DIRECT`.

Expected time: under an hour. Expected loss: at most a day.

### An older backup

`daily/` holds the last 35 nights, `monthly/` the 1st of each month for 400 days. Each `daily/<date>.json` says whether and when that night verified; a dump without one did not verify. Restore any of them as above.

## Locally

```sh
docker build -t finders-eaters:local .
scripts/backup/e2e.sh finders-eaters:local   # about a minute; local Docker only
```

It runs two nightly backups (the first on the 1st of a month), two that must fail (a household fewer; an unknown migration), a staging refresh followed by the release step, and a refresh that must refuse a stale backup.
