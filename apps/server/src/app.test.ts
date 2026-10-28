import { tmpdir } from 'node:os'

import { connect } from '@finders-eaters/db'
import { migrationCount } from '@finders-eaters/db/testing'
import { describe, expect, it } from 'vitest'

import { buildServer } from './app.ts'
import { INDEX_HTML, serverTest, testAuthConfig } from './testing.ts'

describe('/health', () => {
  serverTest(
    'reports a database round-trip with the applied migration count',
    async ({ server }) => {
      const res = await server.inject({ method: 'GET', url: '/health' })

      expect(res.statusCode).toBe(200)
      const body = res.json<{ status: string; database: Record<string, unknown> }>()
      expect(body).toEqual({
        status: 'ok',
        database: {
          ok: true,
          latencyMs: body.database.latencyMs,
          migrationsApplied: migrationCount(),
        },
      })
      expect(body.database.latencyMs).toBeTypeOf('number')
    },
  )

  it('answers 503 with a short error code, never the driver message, when the database is unreachable', async () => {
    // Port 1 refuses connections at once, so the round-trip fails fast.
    const unreachable = connect('postgres://postgres:postgres@127.0.0.1:1/none')
    const down = await buildServer({
      staticDir: tmpdir(),
      db: unreachable.db,
      auth: testAuthConfig,
    })
    try {
      const res = await down.inject({ method: 'GET', url: '/health' })

      expect(res.statusCode).toBe(503)
      expect(res.json()).toEqual({
        status: 'error',
        database: { ok: false, error: 'ECONNREFUSED' },
      })
    } finally {
      await down.close()
      await unreachable.close()
    }
  })
})

describe('server', () => {
  serverTest('serves the SPA shell at the root', async ({ server }) => {
    const res = await server.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toBe(INDEX_HTML)
  })

  serverTest('serves built assets from the static directory', async ({ server }) => {
    const res = await server.inject({ method: 'GET', url: '/app.js' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('console.log("app")')
  })

  serverTest('falls back to the SPA shell for client-side routes', async ({ server }) => {
    const res = await server.inject({ method: 'GET', url: '/recipes/some-recipe' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(INDEX_HTML)
  })

  serverTest('answers unknown API paths with a JSON 404, not the SPA shell', async ({ server }) => {
    const res = await server.inject({ method: 'GET', url: '/api/nope' })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Not Found' })
  })

  serverTest('does not serve the SPA shell for non-read methods', async ({ server }) => {
    const res = await server.inject({ method: 'POST', url: '/recipes' })

    expect(res.statusCode).toBe(404)
  })
})
