// GitHub secrets and variables are checked, not assumed: a gh failure stops
// the wizard, and a value GitHub does not hold afterwards is never reported as
// set. The fakes fail or drop a call on request (PROVISION_FAKE_FAIL,
// PROVISION_FAKE_DROP), the way a real gh might.
import { describe, expect, it } from 'vitest'

import { calls, newState, runWizard, type Reply } from './drive.ts'

const staging: Reply[] = [
  { prompt: /Check again\?/, reply: 'n' },
  { prompt: /Cloudflare account ID/, reply: 'acct0123456789abcdef' },
  { prompt: /Workers AI API token/, reply: 'cf-token-workers-ai-0123456789' },
  { prompt: /Fly organisation/, reply: 'personal' },
  { prompt: /subdomain of homeofed\.com/, reply: 'food' },
  { prompt: /\[y\/N\]/, reply: 'y' },
]

describe('provision.sh GitHub secrets and variables', () => {
  it('stops when gh cannot set a secret', async () => {
    const state = newState()

    const run = await runWizard(['staging', '--dry-run'], staging, {
      state,
      env: { PROVISION_FAKE_FAIL: '^gh secret set CLOUDFLARE_API_TOKEN' },
    })

    expect(run.code).toBe(1)
    expect(run.output).toContain('Setting GitHub secret CLOUDFLARE_API_TOKEN failed')
    expect(run.output).not.toContain('Setup complete')
    expect(calls(state).filter((call) => call.startsWith('fly apps create'))).toEqual([])
  })

  it('checks each secret is in GitHub before moving on', async () => {
    const state = newState()

    const run = await runWizard(['staging', '--dry-run'], staging, {
      state,
      env: { PROVISION_FAKE_DROP: 'CLOUDFLARE_ACCOUNT_ID' },
    })

    expect(run.code).toBe(1)
    expect(run.output).toContain('GitHub secret CLOUDFLARE_ACCOUNT_ID is set was not verified')
    expect(calls(state)).toContain('gh secret list --json name')
    expect(calls(state).filter((call) => call.startsWith('fly apps create'))).toEqual([])
  })

  it('checks each variable is in GitHub with its value before moving on', async () => {
    const state = newState()

    const run = await runWizard(['staging', '--dry-run'], staging, {
      state,
      env: { PROVISION_FAKE_DROP: 'DEPLOY_STAGING_ENABLED' },
    })

    expect(run.code).toBe(1)
    expect(run.output).toContain('GitHub variable DEPLOY_STAGING_ENABLED is true was not verified')
    expect(calls(state).filter((call) => call.startsWith('gh workflow run'))).toEqual([])
  })
})
