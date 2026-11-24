import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { decodeArtifact, encodeArtifact } from './artifact.ts'
import { buildArtifact } from './build.ts'
import { fixtureInputs } from './testing/fixtures.ts'

describe('the compressed artifact', () => {
  const artifact = buildArtifact(fixtureInputs())

  it('round-trips', () => {
    expect(decodeArtifact(encodeArtifact(artifact))).toEqual(artifact)
  })

  it('is byte-identical for unchanged inputs', () => {
    expect(encodeArtifact(buildArtifact(fixtureInputs())).equals(encodeArtifact(artifact))).toBe(
      true,
    )
  })

  it('carries its KB version and the source pins', () => {
    const json = JSON.parse(gunzipSync(encodeArtifact(artifact)).toString()) as Record<
      string,
      unknown
    >
    expect(json.kbVersion).toBe(artifact.kbVersion)
    expect(json.sources).toEqual(fixtureInputs().pins)
  })

  it('refuses a fact with no source', () => {
    const broken = JSON.parse(JSON.stringify(artifact)) as typeof artifact
    delete (broken.aisles[0] as { source?: string }).source
    expect(() => decodeArtifact(encodeArtifact(broken as never))).toThrow(/source/)
  })

  it('refuses bytes that are not an artifact', () => {
    expect(() => decodeArtifact(Buffer.from('not gzip'))).toThrow(/artifact/i)
  })
})
