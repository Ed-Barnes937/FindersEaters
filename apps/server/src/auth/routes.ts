// Mounts Better Auth's handler at `/api/auth/*` (docs/spec/auth.md section 2).
// Fastify hands Better Auth the raw body untouched and a Web `Request`, and the
// client address Fastify resolved (behind the Fly proxy) in a header no client
// can set.
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'

import { CLIENT_IP_HEADER, type Auth } from './auth.ts'

export const authRoutes: FastifyPluginCallback<{ auth: Auth; baseURL: string }> = (
  app,
  opts,
  done,
) => {
  // Encapsulated to this plugin: the body reaches Better Auth as sent.
  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => done(null, body))

  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    handler: async (req, reply) => {
      const response = await opts.auth.handler(toWebRequest(req, opts.baseURL))
      reply.status(response.status)
      response.headers.forEach((value, key) => {
        if (key !== 'set-cookie') void reply.header(key, value)
      })
      const cookies = response.headers.getSetCookie()
      if (cookies.length > 0) void reply.header('set-cookie', cookies)
      return reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null)
    },
  })
  done()
}

function toWebRequest(req: FastifyRequest, baseURL: string): Request {
  const headers = webHeaders(req)
  headers.set(CLIENT_IP_HEADER, req.ip)
  const body = req.body instanceof Buffer && req.body.length > 0 ? req.body : undefined
  return new Request(new URL(req.url, baseURL), { method: req.method, headers, body })
}

/** Headers as a Web `Headers`, for Better Auth's server-side calls. */
export function webHeaders(req: FastifyRequest): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    for (const v of Array.isArray(value) ? value : [value]) headers.append(key, v)
  }
  return headers
}
