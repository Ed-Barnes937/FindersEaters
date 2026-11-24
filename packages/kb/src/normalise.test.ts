import { describe, expect, it } from 'vitest'
import { normaliseName, slugify } from './normalise.ts'

describe('normaliseName', () => {
  it.each([
    ['Tomato purée', 'tomato puree'],
    ['  CRÈME   fraîche ', 'creme fraiche'],
    ["Pig's trotter", "pig's trotter"],
  ])('%s -> %s', (input, expected) => {
    expect(normaliseName(input)).toBe(expected)
  })
})

describe('slugify', () => {
  it.each([
    ['Onion', 'onion'],
    ['Tomato purée', 'tomato-puree'],
    ["Pig's trotter (raw)", 'pig-s-trotter-raw'],
    ['  Red   onion ', 'red-onion'],
  ])('%s -> %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })
})
