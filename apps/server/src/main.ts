// Production entrypoint: `node src/main.ts` (Node 24 runs the TypeScript
// source natively, so the server has no build step).
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildServer } from './app.ts'

const staticDir = process.env.STATIC_DIR
  ? resolve(process.env.STATIC_DIR)
  : fileURLToPath(new URL('../../web/dist', import.meta.url))
const port = Number(process.env.PORT ?? 8080)

const app = await buildServer({ staticDir })
await app.listen({ port, host: '0.0.0.0' })
console.log(`server listening on port ${port}`)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
