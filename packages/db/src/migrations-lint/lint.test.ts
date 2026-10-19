import { describe, expect, test } from 'vitest'
import { lintMigration } from './lint.ts'

// docs/spec/operations.md section 4, rule 4.
describe('lintMigration', () => {
  test.each([
    ['DROP TABLE "plan";', 'DROP'],
    ['ALTER TABLE "plan" DROP COLUMN "name";', 'DROP'],
    ['ALTER TABLE "plan" ALTER COLUMN "kind" DROP DEFAULT;', 'DROP'],
    ['ALTER TABLE "plan" RENAME COLUMN "name" TO "title";', 'RENAME'],
    ['ALTER TABLE "plan" RENAME TO "plans";', 'RENAME'],
    [`ALTER TYPE "public"."units" RENAME VALUE 'a' TO 'b';`, 'RENAME'],
    ['ALTER TABLE "plan" ALTER COLUMN "servings" SET DATA TYPE bigint;', 'ALTER ... TYPE'],
    ['alter table plan alter column servings type bigint;', 'ALTER ... TYPE'],
    ['ALTER TABLE "plan" ALTER COLUMN "name" SET NOT NULL;', 'SET NOT NULL'],
  ])('flags %s', (sql, rule) => {
    expect(lintMigration(sql).map((v) => v.rule)).toEqual([rule])
  })

  test.each([
    'CREATE TABLE "plan" ("id" uuid PRIMARY KEY NOT NULL, "name" text);',
    'ALTER TABLE "plan" ADD COLUMN "drop_reason" text;',
    'ALTER TABLE "plan" ADD COLUMN "renamed" boolean DEFAULT false NOT NULL;',
    'ALTER TABLE "plan" ALTER COLUMN "recipe_id" DROP NOT NULL;',
    `ALTER TYPE "public"."units" ADD VALUE 'us_customary';`,
    'CREATE INDEX "plan_name_idx" ON "plan" USING btree ("name");',
    'ALTER TABLE "plan" ADD CONSTRAINT "plan_fk" FOREIGN KEY ("h") REFERENCES "household"("id") NOT VALID;',
    'ALTER TABLE "plan" VALIDATE CONSTRAINT "plan_fk";',
    `INSERT INTO "note" ("text") VALUES ('drop the rename, it''s set not null');`,
    '-- we never DROP anything here\nCREATE TABLE "a" ("id" uuid);',
    '/* RENAME later */ CREATE TABLE "a" ("id" uuid);',
    'CREATE TABLE "drop" ("rename" text);',
  ])('allows %s', (sql) => {
    expect(lintMigration(sql)).toEqual([])
  })

  test('reports every destructive statement with its line', () => {
    const sql = [
      'CREATE TABLE "a" ("id" uuid);',
      '--> statement-breakpoint',
      'DROP TABLE "b";',
      '--> statement-breakpoint',
      'ALTER TABLE "a" RENAME COLUMN "x" TO "y";',
    ].join('\n')
    expect(lintMigration(sql)).toEqual([
      { rule: 'DROP', line: 3 },
      { rule: 'RENAME', line: 5 },
    ])
  })

  test('a contract line allows destructive statements', () => {
    const sql = [
      '-- contract: drop plan.notes, unread since release 2026-11-02 (#123)',
      'ALTER TABLE "plan" DROP COLUMN "notes";',
    ].join('\n')
    expect(lintMigration(sql)).toEqual([])
  })

  test('a contract line needs a reason', () => {
    const sql = ['-- contract:', 'DROP TABLE "plan";'].join('\n')
    expect(lintMigration(sql).map((v) => v.rule)).toEqual(['DROP'])
  })
})
