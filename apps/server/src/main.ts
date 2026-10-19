// Production entrypoint: `node src/main.ts` (Node 24 runs the TypeScript
// source natively, so the server has no build step). Needs DATABASE_URL,
// BETTER_AUTH_SECRET and BETTER_AUTH_URL (./config.ts).
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { connect } from '@finders-eaters/db'

import { buildServer } from './app.ts'
import { readConfig } from './config.ts'

const config = readConfig(process.env)
const staticDir = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : fileURLToPath(new URL('../../web/dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)

const database = connect(config.databaseUrl)
const app = await buildServer({ staticDir, db: database.db, auth: config.auth })
app.addHook('onClose', () => database.close())
await app.listen({ port, host: '0.0.0.0' })
console.log(`server listening on port ${port}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
