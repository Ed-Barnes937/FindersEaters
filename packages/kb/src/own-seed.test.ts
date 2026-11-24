// The committed own layer parses and every file is a known one; the full build
// against the pinned sources runs in CI (`kb build`), which needs the network.
import { describe, expect, it } from 'vitest'
import { readOwnLayer } from './own.ts'
import { defaults } from './paths.ts'

describe('the committed own layer', () => {
  it('parses, and carries the two known UK clash expectations', async () => {
    const own = await readOwnLayer(defaults.own)
    expect(own.expectations.map((e) => `${e.name} -> ${e.slug}`)).toEqual(
      expect.arrayContaining(['tomato purée -> tomato-concentrate', 'cornflour -> corn-starch']),
    )
    expect(new Set(own.ingredients.map((i) => i.key)).size).toBe(own.ingredients.length)
  })
})
