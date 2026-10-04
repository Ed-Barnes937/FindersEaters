# Research: the cheapest viable fly.io setup for V0.1

Answers [#5](https://github.com/Ed-Barnes937/FindersEaters/issues/5). Researched 2026-10-04 against fly.io, Neon and Supabase primary docs, plus a read-only look at `~/Code/HomeOfEd`. Prices are list prices on that date and are in USD, because Fly and Neon bill in USD.

## Recommendation

- **App**: one Fly app in London (`lhr`), one `shared-cpu-1x` 512MB Machine, scale to zero (`auto_stop_machines = "stop"`, `auto_start_machines = true`, `min_machines_running = 0`). The same Node process serves the API and the built PWA bundle. Copy the HomeOfEd `fly.toml` and Dockerfile shape (see "Reuse with HomeOfEd").
- **Postgres**: **Neon in AWS London (`aws-eu-west-2`)**, on the pay-as-you-go Launch plan (no monthly minimum) rather than Free, for the 7-day restore window. It scales to zero like the app, wakes in a few hundred ms, and has `pgvector` on every plan.
- **Background engine jobs**: run in the web process, and keep the triggering request open until the work finishes. Batch re-parsing goes in a one-off Machine (`fly machine run --rm`) or a Fly scheduled Machine. Do not add an always-on worker process for V0.1.
- **Do not** put Finders Eaters on HomeOfEd's shared `hoe-pg` cluster. Fly has archived that product, its image has no `pgvector`, and HomeOfEd's own ADR 0005 says to move to Managed Postgres once an app holds real user data.
- **Upgrade path**: move to Fly Managed Postgres (MPG) when HA, PITR inside Fly or a single provider matters. If HomeOfEd has already provisioned an MPG cluster (planned for sprout), a Finders Eaters database on that cluster costs only its storage (see option C).

**Estimated monthly cost (1-2 users)**: about **$2.30 (about £1.75)** with Neon Launch, or about **$0.45 (about £0.35)** with Neon Free. The worst case, with the app never scaling down, is about **$6.10 (about £4.60)**. For comparison, the all-Fly MPG route starts at about **$38.60 (about £29)**, or $42 with an always-on app. GBP figures assume $1 = £0.75, and VAT is not included.

## 1. Fly compute pricing

Fly bills per second while a Machine runs. A stopped or suspended Machine is billed only for its root filesystem. ([Pricing](https://docs.fly.io/about/pricing), [Billing](https://docs.fly.io/about/billing))

| Item | Base price (`iad`/`ewr`) | London (`lhr`, x1.1346 markup) |
|---|---|---|
| `shared-cpu-1x` 256MB, always on | $2.19/month | ~$2.48/month |
| `shared-cpu-1x` 512MB, always on | $3.69/month | ~$4.19/month |
| `shared-cpu-1x` 1GB, always on | $6.70/month | ~$7.60/month |
| Stopped or suspended Machine | $0.15/GB/month of rootfs | same |
| Volume | $0.15/GB/month provisioned | same |
| Volume snapshots | $0.08/GB/month, first 10GB free | same |
| Outbound data (Europe) | $0.02/GB | same |
| Dedicated IPv4 | $2/month (optional; shared IPv4 and IPv6 are free) | same |
| SSL certificates | First 10 single-hostname certs free, then $0.10/month each | same |

The `lhr` markup of `1.134615385` comes from the regional table in the pricing page source. New organisations are on Pay As You Go with no platform fee. Organisations on plans discontinued in October 2024 keep their free allowances: 3 `shared-cpu-1x` 256MB VMs, 3GB of volumes and 100GB of EU/NA egress ([Discontinued plans](https://docs.fly.io/about/discontinued-plans)). If Ed's org is one of these, the app Machine may be free. Check the org's plan in the dashboard.

**Size choice**: 512MB is the HomeOfEd standard for Node 22 apps, and it leaves headroom for the engine. 256MB would save about $0.25/month while scaled to zero, which is not worth the risk of running out of memory.

## 2. Scale to zero and cold starts

How it works ([Autostop/autostart](https://docs.fly.io/launch/autostop-autostart), [Fly Proxy autostop reference](https://docs.fly.io/reference/fly-proxy-autostop-autostart)):

- With one Machine, the proxy stops (or suspends) it when it has no traffic. The check "runs every few minutes", and the docs give no exact idle timeout.
- `auto_start_machines = true` makes the proxy start a stopped Machine when a request arrives. `min_machines_running` applies only to the primary region.
- Autostop never creates or destroys Machines. It only starts and stops the ones that exist.

Cold-start cost ([Suspend/resume](https://docs.fly.io/reference/suspend-resume), [Long-running tasks](https://docs.fly.io/blueprints/long-running-tasks)):

| Mode | First request after idle | Caveats |
|---|---|---|
| `stop` | "Cold start: ~2+ seconds for common apps" ("about 2s for a Rails app, less for a small binary") | Simple and durable |
| `suspend` | "a few hundred ms" | Memory must be ≤ 2GB ("not currently recommended" above that; the long-running-tasks page says ≤ 4GB). A deploy invalidates the snapshot. The clock can lag until NTP syncs. Open DB connections look live but may be dead, so the pool must validate and reconnect. "Fly does not guarantee that a suspended machine will resume", so it can still cold start |

Billing is the same in both modes: rootfs only. For a Node 22 image of about 0.5GB that is about $0.08/month while stopped.

**For V0.1, start with `stop`.** A 2-3s first request, made up of the app cold start plus a few hundred ms of Neon wake, is acceptable for 1-2 users. The PWA's service worker serves the app shell from cache, so only the first API call waits. Switch to `suspend` later if the wait annoys, once the Postgres pool handles stale connections. The iPhone Shortcut import pays the cold start too, which is fine for a share action.

**Background work is invisible to autostop.** "Background work running inside the machine ... doesn't count. There's also no way for your application to tell the proxy, 'I'm busy, leave me alone.'" ([Long-running tasks](https://docs.fly.io/blueprints/long-running-tasks)). A job started after a `202 Accepted` can be killed mid-run. That shapes the background-jobs advice in section 5.

## 3. Postgres options

| | A. Neon (external) | B. HomeOfEd `hoe-pg` (unmanaged Fly Postgres) | C. Fly Managed Postgres | D. Supabase (external) | E. Self-run Postgres + volume on Fly |
|---|---|---|---|---|---|
| London | Yes, `aws-eu-west-2` | Yes (`lhr`) | Yes, `lhr` is an MPG region | Yes, `eu-west-2` | Yes |
| Price | Free: $0. Launch: $0.106/CU-hour + $0.35/GB-month, no minimum | Marginal ~$0 (shares an existing cluster) | Basic $38/month (shared-2x, 1GB) + $0.28/GB-month used | Free: $0. Pro: from $25/month | ~$2.48-4.19 compute + $0.15/GB volume |
| Scale to zero | Yes, after 5 min (fixed on Free). Wakes "within a few hundred milliseconds" | Only with the Development config (1h, not configurable) | No | Free projects pause after 1 week of inactivity | Yes, with autostop |
| Backups | Free: 6h history (1GB limit). Launch: up to 7 days of instant restore ($0.20/GB-month) | Daily volume snapshots, 5-day default retention (1-60 days). Optional WAL backups to Tigris (`--enable-backups`) | Included, with PITR and restore to a new cluster (`fly mpg restore --pitr-time`). The docs do not state the window length | Free: none. Pro: daily, 7 days. PITR is $100/month per 7 days | Daily volume snapshots only. You own everything else |
| `pgvector` | Yes, on every plan | **No.** The `postgres-flex` images ship PostGIS but not pgvector. Adding it means forking the image, after which the `fly postgres` commands stop working | Yes, enabled from the Extensions page | Not checked (ruled out on pausing) | Yes, if you build the image |
| HA | Not needed at this scale | Single node (Development config) | Primary + replica, PgBouncer | n/a | Single node |
| Support status | Supported product | **Archived**: "no longer maintained, and Fly.io Support is not able to provide support or guidance for it" | Fly's supported product. Version upgrades and security patches are "not there yet" | Supported. Supabase-on-Fly "is no longer available" | Self-supported |
| Limits | Free: 1GB/project, 100 CU-hours/project, 10 branches, 5GB egress | Volume size | Up to 1TB storage | Free: 500MB DB, 2 projects, 5GB egress | Volume size |

Sources: [Neon pricing](https://neon.com/pricing), [Neon regions](https://neon.com/docs/introduction/regions), [Neon scale to zero](https://neon.com/docs/introduction/scale-to-zero), [Neon pgvector](https://neon.com/docs/extensions/pgvector), [Fly unmanaged Postgres (archived)](https://docs.fly.io/unmanaged-postgres), [Unmanaged backups](https://docs.fly.io/unmanaged-postgres/managing/backup-and-restore), [Unmanaged scale to zero](https://docs.fly.io/unmanaged-postgres/managing/scale-to-zero), [`fly postgres create`](https://docs.fly.io/flyctl/cmd/fly_postgres_create), [postgres-flex `pg17/Dockerfile`](https://github.com/fly-apps/postgres-flex/blob/master/pg17/Dockerfile), [Volume snapshots](https://docs.fly.io/volumes/snapshots), [Managed Postgres](https://docs.fly.io/postgres), [MPG extensions](https://docs.fly.io/postgres/extensions), [MPG create and connect](https://docs.fly.io/postgres/create-and-connect), [`fly mpg restore`](https://docs.fly.io/flyctl/cmd/fly_mpg_restore), [Fly regions](https://docs.fly.io/reference/regions), [Supabase pricing](https://supabase.com/pricing), [Supabase regions](https://supabase.com/docs/guides/platform/regions), [Supabase on Fly](https://docs.fly.io/supabase).

### Why Neon

- **It matches the app's usage pattern.** Both scale to zero, and Neon bills per CU-hour of activity, so a lightly used database costs pennies.
- **pgvector is already there**, which keeps similarity on the table without changing provider.
- **It is in the same city as `lhr`.** The connection crosses the public internet over TLS rather than Fly's private network. Fly charges $0.02/GB for that egress, which is negligible at this scale.
- **Launch over Free**: Free's 6-hour history is too short given the principle "never destroy what the user gave us". Launch costs about $2/month at this scale and gives 7 days of instant restore. Free is fine for the first weeks of development.
- **Leaving is easy**: the app only sees `DATABASE_URL`, so a move to MPG is a `pg_dump | psql` plus a secret change. HomeOfEd ADR 0005 already documents those steps.

### Why not the others

- **B (`hoe-pg`)** is free at the margin, but Fly has archived it, it lacks pgvector, and its only backups are daily snapshots. HomeOfEd's own ADR 0005 names "an app holds real user data that can't be regenerated from migrations" as the trigger for leaving it, and Finders Eaters is exactly that.
- **C (MPG)** is the right long-term home inside Fly, but its $38/month floor is roughly 15x everything else combined. The exception is a shared cluster: MPG supports multiple databases per cluster, so if HomeOfEd's planned sprout MPG cluster exists, a `finderseaters` database on it costs only its storage (about $0.28/GB-month). The trade-off is coupling to a cluster sized and governed for a child-safety app, so treat that as Ed's call.
- **D (Supabase)**: pausing after a week of inactivity is a real risk for 1-2 users (holidays), Free has no backups, and Pro starts at $25/month.
- **E (self-run)** costs more than Neon Launch, and backups, upgrades and pgvector packaging all become our problem.

## 4. Static hosting for the PWA

The simplest option is to have the Node server serve the built Vite bundle. That is HomeOfEd's pattern: the sprout image copies `dist` next to the server source. Fly's `[[statics]]` can serve files from the image (or a Tigris bucket) without passing through the Node process, but the Machine must still be running: "Static assets are always served directly from your VM, not from the Fly edge" ([fly.toml reference: statics](https://docs.fly.io/reference/configuration)). So on Fly, statics do not avoid a cold start. The service worker does: after the first visit, the app shell loads from cache with no request to Fly.

HomeOfEd puts Cloudflare in front of Fly as DNS/CDN (`docs/hosting.md`). Behind a proxied Cloudflare record, hashed static assets can be edge-cached so that cold loads of the shell do not wake the Machine. That is optional for 1-2 users.

## 5. Background engine jobs

The options Fly documents ([Task scheduling](https://docs.fly.io/blueprints/task-scheduling), [Long-running tasks](https://docs.fly.io/blueprints/long-running-tasks)):

| Option | Cost at V0.1 scale | Fit |
|---|---|---|
| **In the request**: import calls the engine and responds when done | $0 extra | **Recommended for V0.1.** Engine runs are short per recipe (Jev classification calls). Keeping the request open is enough to stop autostop |
| **One-off Machine**: `fly machine run --rm` with the same image | Per-second compute while it runs | Recommended for batch re-parse when the engine improves. It is a human-run or CI-run operation |
| **Scheduled Machine**: hourly/daily/weekly/monthly | Per-second compute while it runs | Good for any periodic sweep ("roughly once a day is good enough") |
| **Always-on worker process group** (HomeOfEd ADR 0014) | ~$4.19/month (512MB `lhr`) | Not needed yet. It would double the bill for no V0.1 benefit |
| **Autostop off, app exits when idle with no jobs in flight** | $0 extra; needs a `SIGTERM` drain and `kill_timeout` | The fallback if in-request work becomes too slow and an async `202` flow is wanted |
| **Cron Manager / Supercronic** | A separate always-on app, or a cron process | Overkill for V0.1 |

## 6. Reuse with HomeOfEd

What HomeOfEd does (read from `~/Code/HomeOfEd`: `docs/hosting.md`, ADRs 0001, 0005, 0014, `apps/*/fly.toml`, `apps/sprout/Dockerfile`, `docs/runbooks/phase-4-go-live.md`):

- A pnpm/turbo monorepo with one Docker image and one Fly app per app, all in `lhr`. Cloudflare provides DNS and proxying for `homeofed.com`.
- Each `fly.toml` uses `shared-cpu-1x` 512MB, `auto_stop_machines = 'stop'`, `release_command` for journal-tracked Drizzle migrations, and a deep `/health` check that round-trips to Postgres. 7 of 10 apps set `min_machines_running = 0`.
- Multi-stage Dockerfile: `turbo prune`, then `pnpm install --prod`, then `node:22-slim`, running TypeScript source natively through Node type stripping.
- Drizzle against real Postgres in production, and PGlite (WASM Postgres) as the test and simulator fake (ADR 0001).
- One shared unmanaged cluster, `hoe-pg`, with one database per app attached via `fly postgres attach`. ADR 0005 plans a move to MPG, and sprout's `fly.toml` says sprout itself will use MPG.
- Scheduled work runs as a `worker` process group in the same app (ADR 0014).

What Finders Eaters can share:

- **The Fly org**: one bill, the private network, and an org-scoped deploy token. Sprout's notes warn that HomeOfEd's existing token is scoped to `hoe-hub`, so CI for a new app needs an org-scoped token or its own app-scoped one.
- **Cloudflare DNS**: if it lives under `homeofed.com`, it gets a proxied CNAME to `<app>.fly.dev` with Full (strict) TLS, as in the go-live runbook.
- **Patterns to copy as-is**: the `fly.toml` shape (copy `apps/wotd/fly.toml`, which already scales to zero), the Dockerfile shape, `release_command` migrations, the Drizzle + PGlite driver swap for tests, and the deep health check.
- **An MPG cluster, if one exists** (option C above).
- **Not `hoe-pg`** (see section 3).
- Whether Finders Eaters should join the HomeOfEd monorepo to reuse `@hoe/db` and `@hoe/backend-kit` directly is a repo-structure question this ticket does not settle.

One point to verify at go-live: whether Fly's `[[http_service.checks]]` deep health check, which queries Postgres every 30s while the Machine runs, keeps Neon awake. It can only fire while the app Machine is up, so it does not stop either from scaling to zero. A shallow check would let Neon idle sooner within a session.

## 7. Monthly cost estimate

Assumptions: 1-2 users. The app is awake about 2 hours a day (about 60 h/month, roughly 8% of the month). The image is about 0.5GB, the database is under 0.5GB, egress is under 1GB, and the smallest Neon compute is 0.25 CU (an assumption about the minimum size, not confirmed in the sources above). $1 = £0.75.

| Item | Neon Free | Neon Launch (recommended) | Worst case (app always on, Neon Launch) | All-Fly MPG Basic |
|---|---|---|---|---|
| App Machine, 512MB `lhr`, running | ~$0.35 | ~$0.35 | $4.19 | ~$0.35 |
| App rootfs while stopped (~0.5GB) | ~$0.07 | ~$0.07 | $0 | ~$0.07 |
| Postgres compute | $0 | ~$1.59 (15 CU-h) | ~$1.59 | $38.00 |
| Postgres storage + history | $0 | ~$0.28 | ~$0.28 | ~$0.14 |
| Egress, certs, shared IPv4 | ~$0.02 | ~$0.02 | ~$0.02 | ~$0.02 |
| Background jobs (occasional one-off Machine) | ~$0.01 | ~$0.01 | ~$0.01 | ~$0.01 |
| **Total (USD)** | **~$0.45** | **~$2.32** | **~$6.10** | **~$38.60** |
| **Total (GBP)** | **~£0.35** | **~£1.75** | **~£4.60** | **~£29** |

If Neon stays awake longer than the app (for example, because a health check keeps querying it), Launch compute grows by about $0.03 per extra hour at 0.25 CU. Even a Neon compute running 24/7 at 0.25 CU would be about $19/month, so watch Neon's usage page in the first month. A legacy-plan Fly org would zero the app line.

## Open points for later tickets

- Confirm Ed's Fly org plan (Pay As You Go or legacy allowances) and whether HomeOfEd's MPG cluster has been provisioned.
- Ops ticket: Neon restore drills, migration via `release_command`, and how re-parse batch jobs are launched.
- Revisit `suspend` once the Postgres pool handles reconnects after resume.
