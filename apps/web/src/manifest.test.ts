// @vitest-environment node
// The web manifest's colours come from the design tokens
// (docs/design-reference/tokens.css), not from a second copy that can drift.
import { readFileSync } from 'node:fs'

import { expect, it } from 'vitest'

import { manifest } from '../manifest.ts'

const tokens = readFileSync(
  new URL('../../../docs/design-reference/tokens.css', import.meta.url),
  'utf8',
)
const light = tokens.slice(0, tokens.indexOf('@media'))
const token = (name: string) => new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(light)?.[1]

it('installs as a standalone app coloured from the tokens', () => {
  expect(manifest.display).toBe('standalone')
  expect(manifest.background_color?.toLowerCase()).toBe(token('color-bg')?.toLowerCase())
  expect(manifest.theme_color?.toLowerCase()).toBe(token('color-bg')?.toLowerCase())
  expect(manifest.start_url).toBe('/')
  expect(manifest.scope).toBe('/')
})

it('has 192 and 512 px icons, one maskable', () => {
  const sizes = manifest.icons?.map((i) => i.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
  expect(manifest.icons?.some((i) => i.purpose === 'maskable')).toBe(true)
})
