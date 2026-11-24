import { createHash } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fetchSources } from './fetch.ts'
import type { SourcePins } from './pins.ts'
import { intake24Xml, offText, usdaFiles } from '../testing/fixtures.ts'

const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')
const enc = (s: string) => new TextEncoder().encode(s)

let server: Server
let base: string
let cache: string
let hits: Record<string, number>
let failures: Record<string, number>
const noWait = () => Promise.resolve()
const zip = zipSync({
  'FoodData_Central_sr_legacy_food_csv_2018-04/food.csv': enc(usdaFiles.food),
  'FoodData_Central_sr_legacy_food_csv_2018-04/food_portion.csv': enc(usdaFiles.portion),
  'FoodData_Central_sr_legacy_food_csv_2018-04/measure_unit.csv': enc(usdaFiles.measureUnit),
})
const bodies: Record<string, Uint8Array> = {
  '/ingredients.txt': enc(offText),
  '/foods.xml': enc(intake24Xml),
  '/sr.zip': zip,
}

beforeEach(async () => {
  hits = {}
  failures = {}
  server = createServer((req, res) => {
    const body = bodies[req.url ?? '']
    hits[req.url ?? ''] = (hits[req.url ?? ''] ?? 0) + 1
    if ((failures[req.url ?? ''] ?? 0) > 0) {
      failures[req.url ?? '']!--
      return void res.writeHead(503).end()
    }
    if (!body) return void res.writeHead(404).end()
    res.writeHead(200).end(body)
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const address = server.address()
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  cache = await mkdtemp(join(tmpdir(), 'kb-cache-'))
})

afterEach(async () => {
  await new Promise((r) => server.close(r))
  await rm(cache, { recursive: true, force: true })
})

function pinsFor(overrides: Partial<Record<string, string>> = {}): SourcePins {
  const git = { repo: 'o/r', commit: 'a'.repeat(40), path: 'p' }
  return {
    off: {
      ...git,
      url: `${base}/ingredients.txt`,
      sha256: overrides.off ?? sha(bodies['/ingredients.txt']!),
    },
    intake24: { ...git, url: `${base}/foods.xml`, sha256: sha(bodies['/foods.xml']!) },
    usda: { release: 'sr', url: `${base}/sr.zip`, sha256: sha(zip) },
  }
}

describe('fetchSources', () => {
  it('downloads each pinned source, verifies its checksum and unpacks the USDA files', async () => {
    const texts = await fetchSources(pinsFor(), cache)
    expect(texts.off).toBe(offText)
    expect(texts.intake24).toBe(intake24Xml)
    expect(texts.usda).toEqual(usdaFiles)
  })

  it('serves a second run from the cache without touching the network', async () => {
    await fetchSources(pinsFor(), cache)
    const before = { ...hits }
    await fetchSources(pinsFor(), cache)
    expect(hits).toEqual(before)
    expect((await readdir(cache)).length).toBe(3)
  })

  it('fails on a checksum mismatch and caches nothing for it', async () => {
    await expect(fetchSources(pinsFor({ off: '0'.repeat(64) }), cache)).rejects.toThrow(/checksum/i)
    expect(await readdir(cache)).not.toContain('0'.repeat(64))
  })

  it('retries a 5xx and then succeeds', async () => {
    failures['/foods.xml'] = 1
    const texts = await fetchSources(pinsFor(), cache, fetch, noWait)
    expect(texts.intake24).toBe(intake24Xml)
    expect(hits['/foods.xml']).toBe(2)
  })

  it('retries a network error and then succeeds', async () => {
    let first = true
    const flaky: typeof fetch = (input, init) => {
      if (first) {
        first = false
        return Promise.reject(new TypeError('fetch failed'))
      }
      return fetch(input, init)
    }
    const texts = await fetchSources(pinsFor(), cache, flaky, noWait)
    expect(texts.off).toBe(offText)
  })

  it('gives up after three attempts', async () => {
    failures['/foods.xml'] = 99
    await expect(fetchSources(pinsFor(), cache, fetch, noWait)).rejects.toThrow(/503/)
    expect(hits['/foods.xml']).toBe(3)
  })

  it('does not retry a 404', async () => {
    const pins = pinsFor()
    pins.intake24.url = `${base}/missing.xml`
    await expect(fetchSources(pins, cache, fetch, noWait)).rejects.toThrow(/404/)
    expect(hits['/missing.xml']).toBe(1)
  })

  it('does not retry a checksum mismatch', async () => {
    await expect(
      fetchSources(pinsFor({ off: '0'.repeat(64) }), cache, fetch, noWait),
    ).rejects.toThrow(/checksum/i)
    expect(hits['/ingredients.txt']).toBe(1)
  })

  it('re-downloads a cached file that no longer matches its checksum', async () => {
    await fetchSources(pinsFor(), cache)
    await writeFile(join(cache, sha(bodies['/foods.xml']!)), 'corrupt')
    const texts = await fetchSources(pinsFor(), cache)
    expect(texts.intake24).toBe(intake24Xml)
  })
})
