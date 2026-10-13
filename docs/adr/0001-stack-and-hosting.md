# Standalone repo on HomeOfEd's stack, one Fly app, Neon Postgres, no job queue

- **Status:** accepted (agent-decided in [Choose the stack and hosting](https://github.com/Ed-Barnes937/FindersEaters/issues/6), reversible at the cost noted below)
- **Date:** 2026-10-13

Finders Eaters lives in its own repo but copies the HomeOfEd stack Ed already runs (pnpm + Turborepo, Fastify + tRPC, Drizzle, React SPA with TanStack Router and Query, Vite, Zod, Vitest, Playwright). It ships as one Docker image on one scale-to-zero Fly Machine in `lhr`, against Neon Postgres in London, and runs engine work inside the request that needs it instead of on a job queue.

## Considered options

- **Inside the HomeOfEd monorepo**, reusing `backend-kit`, `db`, `logger` and `test-kit`. Rejected: HomeOfEd is a hub of leaf apps on shared infrastructure, while this is a product that will grow its own Capacitor shell, public import API and release cadence. Cross-repo package reuse would need publishing, so we copy the patterns, not the packages. Moving in later is a `git subtree` plus swapping local packages for `@hoe/*` ones.
- **REST or Hono instead of Fastify + tRPC.** Rejected for the app's own API (one TypeScript client, so end-to-end types win). The public surfaces that outside clients call (the import endpoint used by the iPhone Shortcut and the share target) are plain versioned HTTP routes beside tRPC, as in HomeOfEd ADR 0015.
- **A Postgres-backed queue (graphile-worker or pg-boss) for engine runs.** Rejected for V0.1: autostop cannot see background work, so a job started after a `202` can be killed, and an always-on worker costs more than the whole app. Revisit when link packs bring bulk imports.

## Consequences

- The engine is a pure package with no database access, called through one seam, so moving it onto a queue later changes the caller, not the engine.
- Every recipe records whether its engine run is complete and which engine version produced it, so an interrupted or stale run is finished lazily or by the batch re-parse command.
- Leaving Neon for Fly Managed Postgres is a `pg_dump` and restore plus a connection string change. Nothing uses Neon-only features (no serverless driver, no branching inside the app).
