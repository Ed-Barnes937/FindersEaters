// The staging half of the provisioning wizard, rehearsed with --dry-run: every
// CLI it calls (fly, gh, neonctl, psql, aws, curl, the browser) is a fake from
// scripts/provision/fakes, so nothing outside this machine is touched.
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { calls, creates, fake, fakeNames, newState, runWizard, type Reply } from './drive.ts'

const accountId = 'acct0123456789abcdef'
const token = 'cf-token-workers-ai-0123456789'

const firstRun: Reply[] = [
  { prompt: /Create the Neon project/, reply: 'y' },
  { prompt: /Create the Neon branch staging/, reply: 'y' },
  { prompt: /Cloudflare account ID/, reply: accountId },
  { prompt: /Workers AI API token/, reply: token },
  { prompt: /Fly organisation/, reply: 'personal' },
  { prompt: /Create the Fly app finders-eaters-staging/, reply: 'y' },
  { prompt: /subdomain of homeofed\.com/, reply: 'food' },
  { prompt: /Turn staging deploys on/, reply: 'y' },
  { prompt: /Add the certificate for food-staging\.homeofed\.com/, reply: 'y' },
]

describe('provision.sh staging --dry-run', () => {
  it('provisions staging from nothing and ends with staging deployed and /health passing', async () => {
    const state = newState()

    const run = await runWizard(['staging', '--dry-run'], firstRun, { state })

    expect(run.output).toContain('Setup complete')
    expect(run.output).not.toContain('Stopped')
    expect(run.code).toBe(0)
    const log = calls(state)
    expect(log).toContain(
      'neonctl projects create --name finders-eaters --region-id aws-eu-west-2 --pg-version 17 --output json',
    )
    expect(log).toContain('fly apps create finders-eaters-staging --org personal')
    expect(fakeNames(state, 'fly/secrets/finders-eaters-staging')).toEqual([
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'DATABASE_URL',
      'DATABASE_URL_DIRECT',
    ])
    expect(fake(state, 'fly/secrets/finders-eaters-staging/BETTER_AUTH_URL')).toBe(
      'https://food-staging.homeofed.com',
    )
    expect(fake(state, 'fly/secrets/finders-eaters-staging/DATABASE_URL')).toContain('-pooler')
    expect(fake(state, 'fly/secrets/finders-eaters-staging/DATABASE_URL_DIRECT')).not.toContain(
      '-pooler',
    )
    expect(fakeNames(state, 'gh/secrets')).toEqual([
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'FLY_API_TOKEN_STAGING',
      'STAGING_DATABASE_URL_DIRECT',
    ])
    expect(fake(state, 'gh/variables/DEPLOY_STAGING_ENABLED')).toBe('true')
    expect(log).toContain('gh workflow run deploy-staging.yml --ref develop')
    expect(fake(state, 'fly/deployed/finders-eaters-staging')).toBeDefined()
    expect(run.output).toMatch(/finders-eaters-staging\.fly\.dev\/health.*ok/)
    expect(log).toContain('fly certs add food-staging.homeofed.com -a finders-eaters-staging')
  })

  it('is safe to rerun: a second run creates nothing and keeps every secret', async () => {
    const state = newState()
    await runWizard(['staging', '--dry-run'], firstRun, { state })
    const firstCalls = calls(state).length
    const authSecret = fake(state, 'fly/secrets/finders-eaters-staging/BETTER_AUTH_SECRET')
    const deployToken = fake(state, 'gh/secrets/FLY_API_TOKEN_STAGING')

    // Enter at every prompt keeps the remembered values; no to every question.
    const rerun = await runWizard(['staging', '--dry-run'], [{ prompt: /\[y\/N\]/, reply: 'n' }], {
      state,
    })

    expect(rerun.output).toContain('Setup complete')
    expect(rerun.code).toBe(0)
    const again = calls(state).slice(firstCalls)
    expect(again.filter((call) => creates.test(call))).toEqual([])
    expect(fake(state, 'fly/secrets/finders-eaters-staging/BETTER_AUTH_SECRET')).toBe(authSecret)
    expect(fake(state, 'gh/secrets/FLY_API_TOKEN_STAGING')).toBe(deployToken)
    expect(fake(state, 'gh/secrets/CLOUDFLARE_API_TOKEN')).toBe(token)
  })

  it('reruns cleanly when the app has a secret beyond the six it needs', async () => {
    const state = newState()
    await runWizard(['staging', '--dry-run'], firstRun, { state })
    writeFileSync(join(state, 'fake/fly/secrets/finders-eaters-staging/SENTRY_DSN'), 'https://x')

    const rerun = await runWizard(['staging', '--dry-run'], [{ prompt: /\[y\/N\]/, reply: 'n' }], {
      state,
    })

    expect(rerun.output).toContain('finders-eaters-staging has its six secrets')
    expect(rerun.code).toBe(0)
  })
})
