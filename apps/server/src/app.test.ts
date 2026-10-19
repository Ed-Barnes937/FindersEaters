import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildServer } from './app.ts'

const INDEX_HTML = '<!doctype html><title>Finders Eaters</title><div id="root"></div>'

let staticDir: string
let app: FastifyInstance

beforeEach(async () => {
  staticDir = await mkdtemp(join(tmpdir(), 'fe-static-'))
  await writeFile(join(staticDir, 'index.html'), INDEX_HTML)
  await writeFile(join(staticDir, 'app.js'), 'console.log("app")')
  app = await buildServer({ staticDir })
})

afterEach(async () => {
  await app.close()
  await rm(staticDir, { recursive: true, force: true })
})

describe('server', () => {
  it('reports health on /health', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })

  it('serves the SPA shell at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toBe(INDEX_HTML)
  })

  it('serves built assets from the static directory', async () => {
    const res = await app.inject({ method: 'GET', url: '/app.js' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe('console.log("app")')
  })

  it('falls back to the SPA shell for client-side routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/recipes/some-recipe' })

    expect(res.statusCode).toBe(200)
    expect(res.body).toBe(INDEX_HTML)
  })

  it('answers unknown API paths with a JSON 404, not the SPA shell', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Not Found' })
  })

  it('does not serve the SPA shell for non-read methods', async () => {
    const res = await app.inject({ method: 'POST', url: '/recipes' })

    expect(res.statusCode).toBe(404)
  })
})
