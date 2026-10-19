import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` writes reviewed, immutable SQL migrations into
// migrations/ (docs/spec/operations.md section 4). `drizzle-kit push` is for a
// local database only.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/finders_eaters',
  },
  strict: true,
})
