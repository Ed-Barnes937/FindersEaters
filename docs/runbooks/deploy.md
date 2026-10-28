# Deploy, switch-on and rollback

How the two Fly apps are deployed, how the owner turns deploys on, and how to roll back. The design is `docs/spec/operations.md` sections 2, 3, 3.1 and 3.2; this is the operating manual for it.

## What exists in the repo

| File | What it does |
| --- | --- |
| `Dockerfile` | The one image both apps run: server and `db` sources, SQL migrations, production dependencies, the built SPA. |
| `fly.toml`, `fly.staging.toml` | `finders-eaters` (production) and `finders-eaters-staging`: `lhr`, `shared-cpu-1x` 512 MB, scale to zero, `/health` check, release step with a 10 minute timeout. Identical apart from `app`; `scripts/check-fly-configs.py` enforces that in CI. |
| `apps/server/src/cli.ts release` | The release step: migrate under the advisory lock (`lock_timeout` 5s, `statement_timeout` 60s), then the KB load, projection rebuild and staleness report (placeholders until those tickets land). Exit 0 done, 1 failed, 2 misconfigured. |
| `/health` | Deep database round-trip: `200 {"status":"ok","database":{"ok":true,"latencyMs":..,"migrationsApplied":..}}`, or `503` with a short error code. |
| `.github/workflows/deploy-staging.yml` | Push to `develop` deploys staging. |
| `.github/workflows/deploy-production.yml` | Push to `main` deploys production, with the Clef canary step first (a placeholder until #66). |
| `.github/workflows/deploy.yml` | The shared job: gate, `fly deploy --local-only`, `/health` smoke test. One concurrency group per environment. |
| `scripts/image-smoke.sh` | Proves a built image deploys from empty: a fresh Postgres container, the release step twice, a release that must fail, then `/health`. Local Docker only; CI runs it on every PR. |

## Deploys are off until the owner turns them on

Both deploy workflows run on their branch pushes, but the `gate` job stops them with a notice (the run passes) unless both are true:

- the repository variable `DEPLOY_STAGING_ENABLED` (or `DEPLOY_PRODUCTION_ENABLED`) is `true`;
- the secret `FLY_API_TOKEN_STAGING` (or `FLY_API_TOKEN_PRODUCTION`) is set.

Nothing creates, changes or pays for infrastructure until the owner does the steps below. Neither workflow runs on a pull request.

### Owner checklist (real infrastructure, costs money)

Each of these is a human step. `scripts/provision.sh staging`, then `scripts/provision.sh production`, walks through all of them except the optional step 5, in order, verifying each (`docs/runbooks/provisioning.md`). They are listed here so it is clear what the deploy needs.

1. Neon: project in AWS London, root branch `main`, branch `staging`, restore window 7 days.
2. Fly: create both apps (`fly apps create finders-eaters`, `fly apps create finders-eaters-staging`) in the right org.
3. Fly secrets, per app (`fly secrets set -a <app> ...`): `DATABASE_URL` (Neon pooled), `DATABASE_URL_DIRECT` (Neon direct), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (scoped to Workers AI), `BETTER_AUTH_SECRET` (different per app), `BETTER_AUTH_URL`. There is no Jev key.
4. GitHub secrets: `FLY_API_TOKEN_STAGING` = `fly tokens create deploy -a finders-eaters-staging`, `FLY_API_TOKEN_PRODUCTION` = `fly tokens create deploy -a finders-eaters`. App-scoped deploy tokens, not an org token.
5. Optional but recommended: in GitHub, Settings, Environments, `production`, add yourself as a required reviewer, so every production deploy waits for your click. (The environment appears after the first enabled run, or create it by hand.)
6. Switch staging on: set the repository variable `DEPLOY_STAGING_ENABLED=true`, then run **Deploy staging** from the Actions tab (or push to `develop`). Check the log shows `release: done` and the smoke test's `/health` body.
7. Switch production on the same way with `DEPLOY_PRODUCTION_ENABLED=true`, once the canary (#66) is in.
8. Cloudflare DNS records for the `homeofed.com` subdomains, and `fly certs add` for each.

To turn deploys off again, delete the variable or set it to anything but `true`.

## A deploy, step by step

1. The gate checks the switch and the token.
2. Production only: the Clef canary runs; a mismatch fails the job before anything deploys.
3. `flyctl deploy --local-only` builds the image on the runner and pushes it to Fly's registry.
4. Fly runs `node apps/server/src/cli.ts release` on a temporary Machine with the app's secrets. A non-zero exit aborts the deploy: the new Machine never starts and the previous release keeps serving.
5. Fly starts the new Machine and waits for its `/health` check.
6. The workflow calls `https://<app>.fly.dev/health` and fails unless it reports `"status":"ok"`.

The release step's parts are each transactional and idempotent, so after a failure fix forward and redeploy.

## Rollback: redeploy the previous image

Migrations are expand-only within a release (operations.md section 4), so the previous image always runs against the current schema. There are no down migrations.

```sh
APP=finders-eaters          # or finders-eaters-staging
fly releases -a $APP --image          # find the last good release's image ref
fly deploy -a $APP --config fly.toml --image <image ref>   # fly.staging.toml for staging
curl -fsS https://$APP.fly.dev/health
```

The release step runs again on the old image, finds nothing to migrate and passes. Then fix forward on `develop`; the next push to the branch redeploys.

If the problem is data, not code, use the restore window (operations.md section 5.3).

## Locally

```sh
docker build -t finders-eaters:local .
scripts/image-smoke.sh finders-eaters:local   # fresh Postgres container, release twice, a failing release, /health
python3 scripts/check-fly-configs.py          # parses both Fly configs offline
```
