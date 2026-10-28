# Provisioning: the go-live wizard

`scripts/provision.sh` walks the owner through every human-only setup step in `docs/spec/operations.md` section 8 and `docs/spec/v0.1.md` section 15, one stage at a time. Each stage checks its result (a CLI call or an API request) before moving on, and each is safe to rerun: it looks first and only creates what is missing. The agent built and rehearsed it against fakes; only the owner runs it for real, because it creates accounts, apps, buckets, DNS records and secrets that cost money.

## Before you start

- Tools: `fly`, `gh`, `neonctl`, `psql`, `curl`, `jq`, `openssl`, and for production `aws`. On macOS: `brew install flyctl gh neonctl libpq jq awscli`.
- Signed in: `fly auth login`, `gh auth login` (with access to this repo), `neonctl auth`.
- Run it from a clone of this repo; `gh` sets secrets on the repo it is run in.

Rehearse first if you like. A dry run puts fakes for every CLI and the browser first on `PATH`, so it touches nothing real:

```sh
scripts/provision.sh staging --dry-run
```

## Run it

```sh
scripts/provision.sh staging      # first: everything staging needs, ending with a deploy
scripts/provision.sh production   # then: backups, production, the household and users
```

Values worth keeping between runs (the Neon project id, the Cloudflare account ID and token, the generated `BETTER_AUTH_SECRET`s, the `backup` role password, the Tigris key, the household id) are saved to `~/.config/finderseaters/provision.env`, readable only by you. On a rerun, Enter keeps each one. Database URLs are read from Neon each time and not saved.

## Stages

| # | Stage | Staging | Production | Verified by |
| --- | --- | --- | --- | --- |
| 1 | Tools and sign-ins | yes | yes | `fly auth whoami`, `gh auth status`, `neonctl me` |
| 2 | Neon project `finders-eaters` (AWS London, Postgres 17) and the 7-day restore window | yes | yes | `neonctl projects get`: region, version, `history_retention_seconds` = 604800 |
| 3 | Neon branch (`staging`, or the root `main`) and its pooled and direct URLs | `staging` | `main` | the branch is listed; `select 1` over both URLs |
| 4 | Read-only `backup` role, `BACKUP_DATABASE_URL` secret | | yes | logging in as `backup` and checking it reads everything and can write or create nothing (`scripts/provision/backup-role-check.sql`) |
| 5 | Tigris bucket `finders-eaters-backups` (`fly storage create`), lifecycle rules, CI key | | yes | `head-bucket` with the key; the rules read back as daily/ 35 days, monthly/ 400 days; a probe object written, read and deleted |
| 6 | Cloudflare account ID and Workers AI token, as GitHub secrets | yes | yes | one dev-set Clef request (golden line L01, never a held-out line); neither value is printed or put on a command line |
| 7 | Fly app | `finders-eaters-staging` | `finders-eaters` | `fly apps list` |
| 8 | Fly secrets: `DATABASE_URL`, `DATABASE_URL_DIRECT`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `BETTER_AUTH_SECRET` (own per app), `BETTER_AUTH_URL` | yes | yes | `fly secrets list` names all six |
| 9 | GitHub deploy secrets: an app-scoped `fly tokens create deploy` token as `FLY_API_TOKEN_<ENV>`; staging also `STAGING_DATABASE_URL_DIRECT` | yes | yes | `gh secret list` |
| 10 | Switch deploys on (`DEPLOY_<ENV>_ENABLED=true`) and deploy | `develop` | `main`, only once the Clef canary (#66) is in | the workflow run passes, then `https://<app>.fly.dev/health` says ok |
| 11 | Custom domain: `fly certs add`, then a DNS-only CNAME in Cloudflare | `<sub>-staging.homeofed.com` | `<sub>.homeofed.com` | `https://<host>/health` says ok |
| 12 | Household and both users with the admin CLI over `fly ssh console` | | yes | the CLI's output; the household id is kept so a rerun never makes a second one |

Secrets go to Fly with `fly secrets import` and to GitHub with `gh secret set`, both over stdin. The Fly secrets are staged (`--stage`) and apply on the next deploy, which stage 10 runs.

## When a stage fails

The wizard says what was not verified and offers to check again. Saying no stops it, and nothing after that stage is done. Fix the cause and rerun the same command; finished stages pass their checks and move on without changing anything.

A stage it cannot finish yet, such as the production domain and household before production deploys, is listed under "still to do by hand" at the end. Rerun `scripts/provision.sh production` once production is deployed.

## Things to check by eye the first time

These are the parts the dry run cannot prove against the real services:

- **Neon restore window.** The wizard opens the project's settings page. If the setting has moved, it is the project's restore window (history retention).
- **`backup` role grant.** The role is made in SQL, so it does not join `neon_superuser`. If Neon refuses `grant pg_read_all_data`, stop and tell the agent; do not give the role more than read access.
- **Tigris lifecycle rules.** If Tigris rejects prefix-filtered expiration rules, stop and tell the agent, rather than letting backups pile up or expire everything.
- **Cloudflare DNS.** Proxy status must be "DNS only" (grey cloud) for Fly to issue the certificate.

## Tests

`pnpm --filter @finders-eaters/scripts test` drives the wizard over stdin and stdout in dry-run mode for both halves, including reruns and a rejected Cloudflare token, and runs the `backup` role SQL against the test Postgres. The fakes are in `scripts/provision/fakes/`.
