# V0.1 operations: deploy, migrations, backup and restore

Decided in [Define deploy, migration and backup operations](https://github.com/Ed-Barnes937/FindersEaters/issues/21). Every decision here was made by the agent under the owner's standing rules and is reversible: none of it shapes stored data, and every tool choice (GitHub Actions, Tigris, Neon's restore window) can be swapped without a migration. It builds on `docs/adr/0001-stack-and-hosting.md`, `docs/spec/data-model.md` (durable vs derived), `docs/spec/food-knowledge-base.md` section 8 and `docs/spec/engine-pipeline.md` section 7.

## 1. Shape in one paragraph

Two Fly apps, one image each: `finders-eaters` (production, from `main`) and `finders-eaters-staging` (from `develop`), each against its own Neon branch. A deploy runs one **release step** before the new Machine starts: migrate, load the knowledge base if its version changed, rebuild projections if their version changed. Migrations are expand-only within a release, so the previous image always runs against the new schema and a rollback is just redeploying it. Data is protected in two layers: Neon's 7-day restore window for "undo the last few days", and a nightly off-provider `pg_dump` to a Tigris bucket for "Neon is gone". Every nightly backup is restored into a throwaway Postgres in CI and checked, and staging is refreshed by restoring the latest backup into it, so restores are exercised on the real provider before every release.

## 2. Environments

| | Production | Staging |
|---|---|---|
| Fly app | `finders-eaters`, `lhr`, shared-cpu-1x 512MB, scale to zero | `finders-eaters-staging`, same spec |
| Deployed from | `main` (after the owner merges a release PR) | every push to `develop` |
| Database | Neon project in AWS London, root branch `main` | Neon branch `staging` of the same project, its own compute (scale to zero) |
| Data | the household's | a restore of the latest production backup plus `develop`'s migrations (section 6) |
| Domain | `<sub>.homeofed.com` (Cloudflare) | `<sub>-staging.homeofed.com` |

- **Staging holds real household data.** That is the point: `develop`'s migrations, KB loads and re-parses are rehearsed on the real library before `main` gets them. It is acceptable for one household whose owner is the operator. Before any second household exists this needs revisiting (anonymised refresh or synthetic data).
- **Fly secrets** per app: `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT` (migrations, KB load, batch commands), `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (a token scoped to Workers AI, for hosted Clef per `docs/adr/0002-clef-on-workers-ai.md`), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`. Staging gets its own auth secret; the Cloudflare account and token may be shared.
- **GitHub secrets**: one app-scoped Fly deploy token per app (`fly tokens create deploy -a <app>`), not an org token. `BACKUP_DATABASE_URL` (production, direct, a dedicated read-only `backup` role with `pg_read_all_data`), `STAGING_DATABASE_URL_DIRECT`, Tigris keys scoped to the backup bucket, and `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN` for the Clef canary and the manual live golden-set workflow.

## 3. The deploy pipeline

All in GitHub Actions, with one concurrency group per environment so two deploys never overlap.

**On every PR** (to `develop` or `main`):
1. Lint, typecheck, unit tests, the golden-set suite against recorded Clef answers (engine spec section 7).
2. **Migration checks** against a fresh `pgvector/pgvector:pg17` service container: apply every migration from empty; `drizzle-kit check` (the schema and the migration history agree); the destructive-statement lint (section 4).

**On push to `develop`**: build the KB artifact (below), `fly deploy` to staging, then `GET /health` (a deep database round-trip) as a smoke test.

**On push to `main`**: the same, to production.

**The Clef canary** (`docs/adr/0002-clef-on-workers-ai.md`, engine spec section 4): a scheduled workflow, once a day, sends the dev golden requests to hosted Clef and compares the answer fingerprint (choices and probabilities) with the one in engine configuration. The same job runs before every production deploy, and a mismatch blocks that deploy. A daily mismatch fails the job and opens an issue with per-stage scores and the changed answers; production keeps running. About $0.04 a run.

- **The KB artifact.** `kb build` runs in CI before the Docker build (raw source downloads cached by the hash of `sources.json`), and writes one compressed artifact carrying its KB version. The Dockerfile copies it into the image; a missing artifact fails the build. The release step loads it. The image is therefore self-contained: a release never downloads from Open Food Facts, Intake24 or USDA.
- **Each environment builds its own image** from its branch head. Under gitflow the `main` merge has the same tree as the reviewed `develop`, so promoting staging's exact image is not worth the extra plumbing in V0.1.
- **A failed release step aborts the deploy**: Fly never starts the new Machine and the previous version keeps serving. Because the release step's parts are each transactional and idempotent, fixing forward and redeploying is always safe.

### 3.1 The release step

`release_command = "node apps/server/src/cli.ts release"`, with `release_command_timeout` set to 10 minutes. It uses `DATABASE_URL_DIRECT` and runs, in order:

1. **Migrate.** The Drizzle migrator applies pending migrations under a Postgres advisory lock, with `lock_timeout = 5s` and `statement_timeout = 60s` for the session. A lock timeout fails the release rather than queueing behind live traffic.
2. **Load the knowledge base** if the artifact's KB version differs from the loaded one (recorded in `ops.meta`). Upsert and retire, never truncate (data model section 8), in one transaction. Recipes become KB-stale and are re-resolved lazily or by the batch command (section 7).
3. **Rebuild projections** (`recipe_tag`, `recipe_line`, `needs_review`) from stored engine output if the projection version (a constant in `packages/db`, recorded in `ops.meta`) changed. Deterministic, no Clef calls, one transaction.
4. **Report staleness**: print how many recipes have a stale engine version or KB version, so the deploy log says whether the batch re-parse is due.

KB tables' DDL lives in the Drizzle migrations like every other schema, so there is one schema history; the KB load writes rows only.

### 3.2 Rollback

- **Code**: redeploy the previous release's image (`fly releases -a <app> --image`, then `fly deploy --image <ref>`). The release step on the old image finds nothing to migrate. This always works because of the expand-only rule.
- **Data**: section 5's restore window. There are no down migrations.

## 4. Migration rules

1. **Generated, reviewed, immutable.** Migrations are generated with `drizzle-kit generate` from the schema, reviewed as SQL in the PR, and never edited once merged to `develop`. `drizzle-kit push` is for a local database only.
2. **Expand-only within a release.** A release's migrations must leave the schema usable by the previous release's code, because that code serves until the new Machine starts and is the rollback target. Expand operations: new table, new nullable column or column with a default, new index, a constraint added `NOT VALID` then validated, a new enum value.
3. **Contract in a later release.** Dropping a table or column, renaming anything, setting `NOT NULL`, narrowing a type and removing an enum value ship only after a release in which no code reads or writes the thing. A rename is add, backfill and dual-write, switch reads, then drop: three releases at most.
4. **Destructive-statement lint.** CI fails a migration that contains `DROP`, `RENAME`, `ALTER ... TYPE`, `SET NOT NULL` or enum value removal unless the file carries a `-- contract: <what and why>` line. The PR reviewer checks that the previous production release had already stopped using it.
5. **Durable data backfills** go in the migration SQL, idempotent, in the same transaction. They are small at one household's scale.
6. **Derived data is never migrated.** A change to the engine output document is a new engine version and a re-parse. A change to a projection's shape is a projection version bump and a rebuild in the release step. A KB change is a KB version and a load.
7. **Forward fix only.** No down migrations. A bad migration is fixed by a new migration; damaged data is recovered from the restore window.
8. **The foundations land additively**, as `docs/spec/data-model.md` section 9 already requires, so none of them needs a contract step.

### 4.1 Client compatibility

The PWA outlives a deploy: an installed shell keeps running until its service worker updates, and **persisted offline tick mutations can replay days later** against whatever server is live.

- tRPC procedure inputs change additively only (new optional fields). A breaking change is a new procedure; the old one is removed only in a later release.
- **The tick mutation's input is a frozen contract.** It only ever gains optional fields. If it must change shape, a new procedure is added and the old one is kept, translating to the new, until there is evidence that no queued mutations remain (at least 30 days).
- The plain HTTP routes are versioned (`/api/v1/import`); `v1` never breaks.
- The new service worker activates on the next app launch, not mid-session, so a shopper in the shop is never switched to a new client.

## 5. Backup and restore

### 5.1 Layers

| Layer | Covers | Recovery point | Where |
|---|---|---|---|
| Neon restore window, set to 7 days (the Launch plan maximum) | a bad migration, a bad batch re-parse, accidental deletion | any second in the last 7 days | Neon |
| Nightly `pg_dump` to Tigris | losing the Neon project or account, corruption older than 7 days, leaving Neon | last night (at most about 24 hours lost) | Tigris bucket `finders-eaters-backups` |

Staging is a branch of production and is **not** a backup.

### 5.2 The nightly backup job

A scheduled GitHub Actions workflow at 03:15 UTC. GitHub runs it, so it depends on neither Fly nor Neon staying up, and a failure emails the repo owner with no extra monitoring.

1. `pg_dump --format=custom --no-owner --no-acl` of the whole production database with Postgres 17 client tools, as the read-only `backup` role over the direct URL. The whole database means every schema: app tables, `kb` and the Drizzle migration journal. The KB is included because durable rows reference it by foreign key and its pinned sources may vanish upstream.
2. Upload to `daily/<UTC date>.dump`. On the first of the month also copy to `monthly/<YYYY-MM>.dump`.
3. **Verify by restoring**, in the same job, into a `pgvector/pgvector:pg17` service container:
   - `pg_restore --exit-on-error` succeeds;
   - the restored database has at least one household and at least as many recipes as the previous backup's manifest (recipes are soft-deleted, so the count never falls; a smaller number means a truncated or wrong dump);
   - the current `main` release step's migrate runs cleanly against it (a restore is usable by today's code);
   - a deep read (the `/health` query plus one recipe's engine output parsed with its zod schema) succeeds.
4. Write `manifest/latest.json` (date, object key, size, row counts per durable table, migration head, KB version).

A dump that fails verification still stays in the bucket for diagnosis, but the job fails and the manifest is not advanced.

- **Retention** by Tigris lifecycle rules: `daily/` expires after 35 days, `monthly/` after 400 days.
- **Access**: the bucket is private; the CI key can read and write only this bucket. Dumps are not client-side encrypted in V0.1 (they hold one household's recipes, plans, emails and password hashes). Encrypting them with a key held outside CI is the upgrade if the threat model grows.
- **Cost**: a nightly dump wakes Neon's compute for a few minutes and stores a few MB a night, pennies a month.

### 5.3 Restore runbooks

**Undo something recent (within 7 days).**
1. In Neon, create a branch from production at a timestamp just before the damage. Inspect it with `psql`.
2. If the whole database should go back: Neon's branch restore resets production to that point (Neon keeps a backup branch of the pre-restore state). If only some rows were damaged: copy them across with `psql` from the inspection branch.
3. Delete the inspection branch.

**Neon is gone, or move off Neon.**
1. Create a Postgres 17 database with pgvector available (a new Neon project, or Fly Managed Postgres, which is the ADR's upgrade path).
2. Download the latest verified dump (`manifest/latest.json` names it) and `pg_restore --no-owner --no-acl --exit-on-error` into it.
3. Set `DATABASE_URL` and `DATABASE_URL_DIRECT` on the Fly app, then redeploy, so the release step migrates and loads the KB if needed.
4. Repoint `BACKUP_DATABASE_URL` and the staging branch.
Expected time: under an hour. Expected loss: at most a day.

## 6. Staging data refresh

A manually dispatched workflow, run at least once before every release PR from `develop` to `main`:

1. Fail if the latest verified backup is older than 36 hours (this doubles as a backup freshness alarm).
2. Drop every app schema on the staging branch (`public`, `kb`, `drizzle`, `ops`) and `pg_restore` the latest verified dump into it.
3. Redeploy staging from `develop`, so the release step applies `develop`'s pending migrations and KB load to production-shaped data.
4. Print the staleness report.

This is the restore drill on the real provider: if a production backup cannot be restored into Neon and migrated by the next release, the release is blocked before it reaches `main`. Resetting the Neon branch to its parent would be faster but would test nothing, and would not survive a move off Neon.

**Release checklist** (in the release PR template): CI green; staging refreshed and deployed; the staging batch re-parse report (section 7) reviewed if the release changes the engine or KB version; then the owner merges.

## 7. Batch re-parse runbook

Lazy completion keeps every recipe a person opens correct. The batch command exists so that search and the planner, which read projections across the whole library, catch up too. Run it after any release whose staleness report shows stale recipes: staging first, then production.

```
APP=finders-eaters-staging   # then finders-eaters
fly image show -a $APP          # note the deployed image ref
fly machine run <image ref> -a $APP -r lhr --rm --restart no \
  --vm-size shared-cpu-1x --vm-memory 512 \
  -- node apps/server/src/cli.ts reparse --stale --dry-run
fly logs -a $APP --no-tail      # read the diff report
```

Then the same command with `--apply`. The Machine inherits the app's secrets and uses `DATABASE_URL_DIRECT`.

- `--stale` selects recipes whose engine version or KB version is stale; an engine-stale recipe gets a full re-parse, a KB-stale-only recipe gets re-resolution (engine spec section 7).
- The report lists, per recipe, fields changed and flags added or cleared, plus orphaned corrections. On staging it is the review gate; on production it is the record.
- Writes are compare-and-set on the recipe's revision (data model section 4.5), so running it while the household uses the app is safe; a recipe edited mid-run is retried from its new state.
- Clef failures leave recipes `partial`, completed lazily or by the next run. Rerunning is always safe.
- `node apps/server/src/cli.ts rebuild-projections` is available the same way for repairs, though the release step runs it whenever the projection version changes.

If the batch ever needs to run on a timer, the same command becomes a Fly scheduled Machine; nothing in V0.1 needs that.

## 8. Hand-offs

- **Spec assembly**: this file is the operations section of `docs/spec/v0.1.md`. The implementation tickets it implies: Dockerfile and both `fly.toml`s, the CI workflows (PR, deploy, nightly backup, staging refresh, Clef canary), the `cli.ts` commands (`release`, `reparse`, `rebuild-projections`), the `ops.meta` table, the destructive-statement lint, and the human go-live steps (Neon project, branch and restore window, `backup` role, Tigris bucket and lifecycle rules, Fly apps, tokens and secrets including the Cloudflare account ID and Workers AI token, Cloudflare records).
- **Test and evaluation strategy** (still in the map's fog): owns the test database approach; this file only fixes that migration checks run against a `pgvector/pgvector:pg17` container.
