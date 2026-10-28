// Production entrypoint: `node src/main.ts` (Node 24 runs the TypeScript
// source natively, so the server has no build step).
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { connect } from '@finders-eaters/db'

import { buildServer } from './app.ts'

// The pooled URL; migrations and batch commands use DATABASE_URL_DIRECT.
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  process.stderr.write('DATABASE_URL is not set\n')
  process.exit(2)
}

const staticDir = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : fileURLToPath(new URL('../../web/dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)

// A bounded connect, so `/health` answers 503 instead of hanging when the
// database cannot be reached (Neon's cold start is well inside this).
const database = connect(databaseUrl, { connectionTimeoutMillis: 10_000 })
const app = await buildServer({ staticDir, db: database.db })
await app.listen({ port, host: '0.0.0.0' })
console.log(`server listening on port ${port}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app
      .close()
      .then(() => database.close())
      .then(() => process.exit(0))
  })
}
