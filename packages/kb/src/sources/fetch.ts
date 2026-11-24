// Downloads the pinned sources with their checksums verified, and caches the
// raw files by checksum so CI can cache the directory by the hash of
// `sources.json` (docs/spec/operations.md section 3). A cached file that no
// longer matches its checksum is downloaded again.
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { unzipSync } from 'fflate'
import type { SourcePins } from './pins.ts'
import type { UsdaFiles } from './usda.ts'

export interface SourceTexts {
  off: string
  intake24: string
  usda: UsdaFiles
}

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

async function pinnedBytes(
  name: string,
  pin: { url: string; sha256: string },
  cacheDir: string,
  download: typeof fetch,
): Promise<Uint8Array> {
  const cached = join(cacheDir, pin.sha256)
  try {
    const bytes = await readFile(cached)
    if (sha256(bytes) === pin.sha256) return bytes
    await rm(cached)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const response = await download(pin.url)
  if (!response.ok) throw new Error(`${name}: GET ${pin.url} returned ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const actual = sha256(bytes)
  if (actual !== pin.sha256) {
    throw new Error(
      `${name}: checksum mismatch for ${pin.url}: pinned ${pin.sha256}, got ${actual}`,
    )
  }
  await mkdir(cacheDir, { recursive: true })
  const partial = `${cached}.${process.pid}.part`
  await writeFile(partial, bytes)
  await rename(partial, cached)
  return bytes
}

export async function fetchSources(
  pins: SourcePins,
  cacheDir: string,
  download: typeof fetch = fetch,
): Promise<SourceTexts> {
  const text = (bytes: Uint8Array) => new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  // One at a time: a failure leaves no other download running behind it.
  const off = await pinnedBytes('Open Food Facts', pins.off, cacheDir, download)
  const intake24 = await pinnedBytes('Intake24', pins.intake24, cacheDir, download)
  const usdaZip = await pinnedBytes('USDA SR Legacy', pins.usda, cacheDir, download)
  const wanted = {
    'food.csv': 'food',
    'food_portion.csv': 'portion',
    'measure_unit.csv': 'measureUnit',
  } as const
  const unpacked = unzipSync(usdaZip, {
    filter: (file) => (file.name.split('/').pop() ?? '') in wanted,
  })
  const usda: Partial<UsdaFiles> = {}
  for (const [path, bytes] of Object.entries(unpacked)) {
    usda[wanted[(path.split('/').pop() ?? '') as keyof typeof wanted]] = text(bytes)
  }
  for (const [file, key] of Object.entries(wanted)) {
    if (usda[key] === undefined)
      throw new Error(`USDA SR Legacy: ${file} is not in ${pins.usda.url}`)
  }
  return { off: text(off), intake24: text(intake24), usda: usda as UsdaFiles }
}
