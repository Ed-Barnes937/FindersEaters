# Finders Eaters

A household recipe, meal-planning and shopping app. Product and design docs live in `docs/` (start with `docs/spec/v0.1.md`); the domain glossary is `CONTEXT.md`.

## Layout

A pnpm + Turborepo monorepo (`docs/adr/0001-stack-and-hosting.md`):

| Path                   | What                                                                             |
| ---------------------- | -------------------------------------------------------------------------------- |
| `apps/server`          | Fastify server: serves the built web app, `/health`, and later the API           |
| `apps/web`             | React SPA (Vite, TanStack Router and Query, SCSS modules, Base UI)               |
| `apps/web/src/styles/` | `tokens.css`, the app's one set of design tokens (from `docs/design-reference/`) |
| `packages/*`           | `engine`, `kb`, `query`, `scale`, `suggest`, `shopping`, `db` (spec section 4)   |
| `packages/config`      | Shared TypeScript, ESLint and Prettier config                                    |

## Run

Needs Node 24 (`.nvmrc`) and pnpm (`corepack enable` picks the version in `package.json`).

The server needs Postgres: start it with `docker compose up -d --wait` (see Test).

```sh
pnpm install
pnpm build                                   # builds the web app into apps/web/dist
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/finders_eaters
export BETTER_AUTH_SECRET=local-only-secret-at-least-32-characters BETTER_AUTH_URL=http://localhost:8080
DATABASE_URL_DIRECT=$DATABASE_URL node apps/server/src/cli.ts release   # migrate, as a deploy does
pnpm --filter @finders-eaters/server start   # serves it on http://localhost:8080
```

For development, run `pnpm dev` with the same environment: Vite serves the web app with hot reload and proxies `/api` and `/health` to the server on port 8080.

## Deploy

One Docker image, two Fly apps (`fly.toml` production from `main`, `fly.staging.toml` staging from `develop`), deployed by GitHub Actions after the release step. Deploys stay off until the owner provisions and switches them on. Runbook, switch-on checklist and rollback: `docs/runbooks/deploy.md`. Check an image locally with `docker build -t finders-eaters:local . && scripts/image-smoke.sh finders-eaters:local`.

## Test

The database tests need a local Postgres (`pgvector/pgvector:pg17`, the same image CI uses). Start it once with Docker Compose:

```sh
docker compose up -d --wait   # Postgres on localhost:5432, user and password postgres
```

Each test run creates its own throwaway database in it, applies the migrations once and drops it at the end; each test runs in a transaction that is rolled back. Set `DATABASE_URL` to point the tests at another server. Migrations and their rules: `packages/db/migrations/README.md`.

```sh
pnpm lint            # ESLint, every workspace
pnpm typecheck       # tsc, every workspace
pnpm test            # Vitest unit and database tests
pnpm e2e             # Playwright against the production build, 390 px viewport
pnpm format:check    # Prettier
```

Before the first `pnpm e2e`, install the browser once: `pnpm --filter @finders-eaters/web exec playwright install chromium`.

CI (`.github/workflows/ci.yml`) runs all of these on every PR to `develop` and `main`. Retries are 0: a flaky test is a bug to fix, never to re-run.

## Branch

Gitflow. `develop` is the default branch and the target for every code PR.

- Cut feature branches from `develop` as `feature/<issue>-<slug>` and open the PR into `develop`.
- Never push code to `main`. Releases go from `develop` to `main` by PR, after the owner's review.
- Docs-only changes may go straight to `main`.
