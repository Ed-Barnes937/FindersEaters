import { describe, expect, it } from 'vitest'
import { defaultConfig, engineVersion, packageVersion, type EngineConfig } from './index.ts'

/** Every path to a leaf value of a JSON-like value. */
function leafPaths(value: unknown, path: (string | number)[] = []): (string | number)[][] {
  if (Array.isArray(value)) return value.flatMap((v, i) => leafPaths(v, [...path, i]))
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leafPaths(v, [...path, k]))
  }
  return [path]
}

function withLeafChanged(config: EngineConfig, path: (string | number)[]): EngineConfig {
  const copy = structuredClone(config) as unknown as Record<string | number, unknown>
  let node = copy
  for (const key of path.slice(0, -1)) node = node[key] as Record<string | number, unknown>
  const last = path.at(-1)!
  const old = node[last]
  node[last] =
    typeof old === 'number'
      ? old + 0.01
      : typeof old === 'string'
        ? `${old}x`
        : old === null
          ? 'x'
          : !old
  return copy as unknown as EngineConfig
}

describe('engine version', () => {
  it('is the package version plus a config hash', () => {
    expect(engineVersion(defaultConfig)).toMatch(
      new RegExp(`^${packageVersion.replaceAll('.', '\\.')}\\+[0-9a-f]{16}$`),
    )
  })

  it('is stable for equal configs, whatever their key order', () => {
    const reordered = Object.fromEntries(
      Object.entries(structuredClone(defaultConfig)).reverse(),
    ) as unknown as EngineConfig
    expect(engineVersion(reordered)).toBe(engineVersion(defaultConfig))
  })

  it('changes with the model id, the answer fingerprint and the confidence formula', () => {
    const base = engineVersion(defaultConfig)
    const variants: EngineConfig[] = [
      { ...defaultConfig, model: { ...defaultConfig.model, id: '@cf/cloudflare/clef-flash' } },
      { ...defaultConfig, model: { ...defaultConfig.model, answerFingerprint: 'a'.repeat(64) } },
      {
        ...defaultConfig,
        confidenceFormula: 'provider' as unknown as EngineConfig['confidenceFormula'],
      },
    ]
    for (const variant of variants) expect(engineVersion(variant)).not.toBe(base)
  })

  it('changes when any configuration value changes', () => {
    const base = engineVersion(defaultConfig)
    const paths = leafPaths(defaultConfig)
    expect(paths.length).toBeGreaterThan(20)
    for (const path of paths) {
      expect(engineVersion(withLeafChanged(defaultConfig, path)), path.join('.')).not.toBe(base)
    }
  })

  it('changes with the package version', () => {
    expect(engineVersion(defaultConfig, '9.9.9')).not.toBe(engineVersion(defaultConfig))
  })
})
