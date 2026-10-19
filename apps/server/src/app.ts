// The one Fastify process: the built web SPA, `/health`, Better Auth at
// `/api/auth/*`, the tRPC API and (later) the versioned import route. Built
// without listening so tests drive it through `inject()`; `main.ts` listens.
import type { Db } from '@finders-eaters/db'
import fastifyStatic from '@fastify/static'
import { fastifyTRPCPlugin, type FastifyTRPCPluginOptions } from '@trpc/server/adapters/fastify'
import Fastify, { type FastifyInstance } from 'fastify'

import { createAuth, type AuthConfig } from './auth/auth.ts'
import { resolveSession } from './auth/principal.ts'
import { authRoutes, webHeaders } from './auth/routes.ts'
import { appRouter } from './trpc/router.ts'

const API_PREFIXES = ['/api', '/trpc']

export interface ServerOptions {
  /** Directory holding the built web SPA (`apps/web/dist`). */
  staticDir: string
  db: Db
  auth: AuthConfig
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  // One proxy hop: in every deployed environment the Fly proxy is the only
  // thing in front of the app, and it appends the real client address.
  const app = Fastify({ logger: false, trustProxy: (_address, hop) => hop === 0 })
  const auth = createAuth(opts.db, opts.auth)

  // Shallow liveness for now; becomes a database round-trip later
  // (docs/spec/operations.md section 3).
  app.get('/health', () => ({ ok: true }))

  await app.register(authRoutes, { auth, baseURL: opts.auth.baseURL })

  await app.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext: async ({ req }) => ({
        db: opts.db,
        session: await resolveSession(auth, opts.db, webHeaders(req)),
      }),
    } satisfies FastifyTRPCPluginOptions<typeof appRouter>['trpcOptions'],
  })

  await app.register(fastifyStatic, { root: opts.staticDir })

  // SPA fallback: an unknown non-API read gets index.html so client-side
  // routes survive a reload; everything else is a JSON 404.
  app.setNotFoundHandler((req, reply) => {
    const isRead = req.method === 'GET' || req.method === 'HEAD'
    if (isRead && !API_PREFIXES.some((prefix) => req.url.startsWith(prefix))) {
      return reply.sendFile('index.html')
    }
    return reply.status(404).send({ error: 'Not Found' })
  })

  return app
}
