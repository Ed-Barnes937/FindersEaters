// The production half of the provisioning wizard, rehearsed with --dry-run
// after the staging half, as the owner runs them.
import { describe, expect, it } from 'vitest'

import { calls, creates, fake, fakeNames, newState, runWizard, type Reply } from './drive.ts'

const staging: Reply[] = [
  { prompt: /Cloudflare account ID/, reply: 'acct0123456789abcdef' },
  { prompt: /Workers AI API token/, reply: 'cf-token-workers-ai-0123456789' },
  { prompt: /Fly organisation/, reply: 'personal' },
  { prompt: /subdomain of homeofed\.com/, reply: 'food' },
  { prompt: /\[y\/N\]/, reply: 'y' },
]

const production = (canaryLanded: boolean): Reply[] => [
  { prompt: /Is the Clef canary \(#66\) on main\?/, reply: canaryLanded ? 'y' : 'n' },
  { prompt: /access key ID/, reply: 'tid_fake_key' },
  { prompt: /AWS_SECRET_ACCESS_KEY/, reply: 'tsec_fake_secret' },
  { prompt: /Household name/, reply: 'The Barneses' },
  { prompt: /Your email/, reply: 'ed@example.com' },
  { prompt: /Your first name/, reply: 'Ed' },
  { prompt: /Second user's email/, reply: 'partner@example.com' },
  { prompt: /Second user's first name/, reply: 'Sam' },
  { prompt: /\[y\/N\]/, reply: 'y' },
]

async function stagingDone(): Promise<string> {
  const state = newState()
  const run = await runWizard(['staging', '--dry-run'], staging, { state })
  expect(run.code).toBe(0)
  return state
}

describe('provision.sh production --dry-run', () => {
  it('sets up the backup role, the Tigris bucket and production, then the household and both users', async () => {
    const state = await stagingDone()

    const run = await runWizard(['production', '--dry-run'], production(true), { state })

    expect(run.output).toContain('Setup complete')
    expect(run.code).toBe(0)
    const log = calls(state)
    expect(log.filter((call) => call.startsWith('neonctl projects create'))).toHaveLength(1)

    const backupUrl = fake(state, 'gh/secrets/BACKUP_DATABASE_URL') ?? ''
    expect(backupUrl).toMatch(/^postgresql:\/\/backup:[0-9a-f]{64}@ep-fake-main\./)
    expect(backupUrl).not.toContain('-pooler')
    expect(run.output).toContain('backup reads everything and can write nothing')

    expect(log).toContain('fly storage create --name finders-eaters-backups --org personal')
    const lifecycle = JSON.parse(
      fake(state, 'tigris/buckets/finders-eaters-backups/lifecycle.json') ?? '{}',
    ) as { Rules: { Filter: { Prefix: string }; Expiration: { Days: number } }[] }
    expect(lifecycle.Rules.map((r) => [r.Filter.Prefix, r.Expiration.Days])).toEqual([
      ['daily/', 35],
      ['monthly/', 400],
    ])
    expect(fake(state, 'gh/variables/BACKUP_S3_BUCKET')).toBe('finders-eaters-backups')
    expect(fake(state, 'gh/variables/BACKUP_S3_ENDPOINT')).toBe('https://fly.storage.tigris.dev')

    expect(fakeNames(state, 'gh/secrets')).toEqual([
      'BACKUP_DATABASE_URL',
      'BACKUP_S3_ACCESS_KEY_ID',
      'BACKUP_S3_SECRET_ACCESS_KEY',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'FLY_API_TOKEN_PRODUCTION',
      'FLY_API_TOKEN_STAGING',
      'STAGING_DATABASE_URL_DIRECT',
    ])
    expect(fake(state, 'fly/secrets/finders-eaters/BETTER_AUTH_URL')).toBe(
      'https://food.homeofed.com',
    )
    expect(fake(state, 'fly/secrets/finders-eaters/BETTER_AUTH_SECRET')).not.toBe(
      fake(state, 'fly/secrets/finders-eaters-staging/BETTER_AUTH_SECRET'),
    )
    expect(fake(state, 'gh/variables/DEPLOY_PRODUCTION_ENABLED')).toBe('true')
    expect(log).toContain('gh workflow run deploy-production.yml --ref main')
    expect(log).toContain('fly certs add food.homeofed.com -a finders-eaters')

    expect(fakeNames(state, 'household/users')).toEqual(['ed@example.com', 'partner@example.com'])
    expect(run.output).toContain('First password (shown once): fake-first-password-1')
    expect(log).toContain(
      'fly ssh console -a finders-eaters -C node apps/server/src/cli.ts user add --household hh_fake_01 --email partner@example.com --name Sam',
    )
  })

  it('leaves production deploys off until the Clef canary lands, and says what is left', async () => {
    const state = await stagingDone()

    const run = await runWizard(['production', '--dry-run'], production(false), { state })

    expect(run.code).toBe(0)
    expect(fake(state, 'gh/variables/DEPLOY_PRODUCTION_ENABLED')).toBeUndefined()
    expect(calls(state).filter((call) => call.includes('deploy-production.yml'))).toEqual([])
    expect(run.output).toContain('still to do by hand')
    expect(run.output).toContain('production deploys are off')
    expect(run.output).toContain(
      'custom domain food.homeofed.com: rerun once production is deployed',
    )
    expect(run.output).toContain('household and users: rerun once production is deployed')
    expect(fakeNames(state, 'household/users')).toEqual([])
  })

  it('does not make a second household on a rerun', async () => {
    const state = await stagingDone()
    await runWizard(['production', '--dry-run'], production(true), { state })
    const before = calls(state).length

    const rerun = await runWizard(
      ['production', '--dry-run'],
      [{ prompt: /\[y\/N\]/, reply: 'n' }],
      { state },
    )

    expect(rerun.code).toBe(0)
    expect(
      calls(state)
        .slice(before)
        .filter((call) => creates.test(call)),
    ).toEqual([])
    expect(rerun.output).toContain('Household hh_fake_01')
  })
})
