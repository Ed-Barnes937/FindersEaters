import { describe, expect, it } from 'vitest'

import { readConfig } from './config.ts'

const valid = {
  DATABASE_URL: 'postgres://localhost/fe',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'https://app.example.test',
}

describe('readConfig', () => {
  it('reads the database URL and the auth settings', () => {
    expect(readConfig(valid)).toEqual({
      databaseUrl: 'postgres://localhost/fe',
      auth: { secret: 'a'.repeat(32), baseURL: 'https://app.example.test' },
    })
  })

  it('names every missing variable at once', () => {
    expect(() => readConfig({})).toThrow(
      'Missing environment variables: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL',
    )
  })

  it('refuses a secret shorter than 32 characters', () => {
    expect(() => readConfig({ ...valid, BETTER_AUTH_SECRET: 'short' })).toThrow(
      'BETTER_AUTH_SECRET must be at least 32 characters',
    )
  })

  it('refuses an auth URL that is not an http(s) origin', () => {
    expect(() => readConfig({ ...valid, BETTER_AUTH_URL: 'app.example.test' })).toThrow(
      'BETTER_AUTH_URL must be an http or https URL',
    )
  })
})
