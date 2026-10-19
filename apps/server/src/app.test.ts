import { describe, expect } from 'vitest'

import { INDEX_HTML, serverTest } from './testing.ts'

describe('server', () => {
  serverTest('reports health on /health', async ({ server }) => {
    const res = await server.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

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
