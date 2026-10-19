// The one Fastify process: the built web SPA, `/health`, and (later) the tRPC
// API and the versioned import route. Built without listening so tests drive it
// through `inject()`; `main.ts` listens.
import fastifyStatic from '@fastify/static'
import Fastify, { type FastifyInstance } from 'fastify'

const API_PREFIX = '/api'

export interface ServerOptions {
  /** Directory holding the built web SPA (`apps/web/dist`). */
  staticDir: string
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  // Shallow liveness for now; becomes a database round-trip when `db` lands
  // (docs/spec/operations.md section 3).
  app.get('/health', () => ({ ok: true }))

  await app.register(fastifyStatic, { root: opts.staticDir })

  // SPA fallback: an unknown non-API read gets index.html so client-side
  // routes survive a reload; everything else is a JSON 404.
  app.setNotFoundHandler((req, reply) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    if (isRead && !req.url.startsWith(API_PREFIX)) {
      return reply.sendFile('index.html')
    }
    return reply.status(404).send({ error: 'Not Found' })
  })

  return app
}
