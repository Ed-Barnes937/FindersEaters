# Migrations

SQL migrations for the app's single Drizzle schema (`../src/schema/`). The full rules are `docs/spec/operations.md` section 4; this is the short form for whoever adds the next one.

## The expand-only rule

**Within a release, migrations only expand the schema.** The previous release's code keeps serving until the new Machine starts, and it is the rollback target, so it must still work against the migrated database.

| Expand (ships any time)                                  | Contract (ships only in a later release) |
| -------------------------------------------------------- | ---------------------------------------- |
| New table                                                | Drop a table or column                   |
| New nullable column, or a column with a default          | Rename anything                          |
| New index                                                | `SET NOT NULL`                           |
| Constraint added `NOT VALID`, then `VALIDATE CONSTRAINT` | Narrow or change a column type           |
| New enum value                                           | Remove an enum value                     |
| Relax a constraint (`DROP NOT NULL`)                     | Drop a default or constraint             |

A contract step ships only after a release in which no code reads or writes the thing. A rename is add, backfill and dual-write, switch reads, then drop: three releases at most.

## Adding a migration

1. Change the schema in `src/schema/`.
2. `pnpm --filter @finders-eaters/db migrations:generate` writes the next `NNNN_<name>.sql` and its snapshot in `meta/`. Never write or edit migration SQL by hand, except to add a backfill or a contract line.
3. Review the SQL in the PR. Once merged to `develop` a migration is **immutable**: a mistake is fixed by a new migration (forward fix only, no down migrations).
4. Backfills of durable data go in the same migration, idempotent. Derived data (engine output, projections, the KB) is never migrated; it is rebuilt.

`drizzle-kit push` is for a throwaway local database only.

## A planned contract step

The destructive-statement lint (`pnpm --filter @finders-eaters/db migrations:lint`) fails any migration containing `DROP`, `RENAME`, `ALTER ... TYPE` or `SET NOT NULL` (enum value removal is a `DROP TYPE` and re-create, so `DROP` covers it). A contract migration passes only with a line saying what it removes and why it is safe:

```sql
-- contract: drop plan.notes, unread since release 2026-11-02 (#123)
ALTER TABLE "plan" DROP COLUMN "notes";
```

The PR reviewer checks that the previous production release had already stopped using it.

## What CI checks

On every PR (`.github/workflows/ci.yml`), against a `pgvector/pgvector:pg17` service container:

- every migration applies to an empty database;
- `drizzle-kit check` passes (the journal and snapshots are consistent);
- `drizzle-kit generate` produces nothing (the committed migrations match the schema);
- the destructive-statement lint passes.
