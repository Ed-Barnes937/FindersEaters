// The Cloudflare stage verifies the Workers AI token with one dev-set Clef
// request and never shows the account ID or the token.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calls, fake, fakeNames, newState, runWizard, scriptsDir, type Reply } from './drive.ts'

const accountId = 'acct0123456789abcdef'
const token = 'cf-token-workers-ai-0123456789'

const upToCloudflare: Reply[] = [
  { prompt: /Create the Neon project/, reply: 'y' },
  { prompt: /Create the Neon branch staging/, reply: 'y' },
  { prompt: /Cloudflare account ID/, reply: accountId },
]

interface GoldenLine {
  id: string
  line: string
  set?: string
}

describe('provision.sh: the Cloudflare Workers AI stage', () => {
  it('sends the dev golden line L01 to Clef and never echoes the account ID or token', async () => {
    const state = newState()

    const run = await runWizard(
      ['staging', '--dry-run'],
      [
        ...upToCloudflare,
        { prompt: /Workers AI API token/, reply: token },
        { prompt: /Fly organisation/, reply: 'personal' },
        { prompt: /\[y\/N\]/, reply: 'y' },
        { prompt: /subdomain of homeofed\.com/, reply: 'food' },
      ],
      { state },
    )

    expect(run.code).toBe(0)
    expect(run.output).toContain(
      'Clef answered dev line L01 ("200g basmati rice"): role = ingredient',
    )
    const sent = JSON.parse(fake(state, 'cloudflare/last-request.json') ?? 'null') as {
      state: { line: string }
      model: string
    }
    const golden = JSON.parse(
      readFileSync(join(scriptsDir, '../docs/ideation/research/jev-spike/golden.json'), 'utf8'),
    ) as { lines: GoldenLine[] }
    const l01 = golden.lines.find((line) => line.id === 'L01')
    expect(l01?.set ?? 'dev').toBe('dev')
    expect(sent.state.line).toBe(l01?.line)
    expect(sent.model).toBe('clef')

    // The values the owner pasted reach Fly and GitHub, but never the screen
    // or any command line.
    expect(fake(state, 'gh/secrets/CLOUDFLARE_ACCOUNT_ID')).toBe(accountId)
    expect(fake(state, 'fly/secrets/finders-eaters-staging/CLOUDFLARE_API_TOKEN')).toBe(token)
    for (const secret of [accountId, token]) {
      expect(run.output).not.toContain(secret)
      expect(calls(state).join('\n')).not.toContain(secret)
    }
  })

  it('stops on a rejected token without storing it anywhere, and says why without echoing it', async () => {
    const state = newState()
    const revoked = 'cf-token-revoked-9876543210'

    const run = await runWizard(
      ['staging', '--dry-run'],
      [
        ...upToCloudflare,
        { prompt: /Workers AI API token/, reply: revoked },
        { prompt: /Paste new values and try again\?/, reply: 'n' },
      ],
      { state },
    )

    expect(run.code).toBe(1)
    expect(run.output).toContain('Workers AI did not answer (HTTP 401)')
    expect(run.output).toContain('10000: Authentication error')
    expect(run.output).toContain('The Cloudflare token was not verified.')
    expect(run.output).not.toContain(revoked)
    expect(run.output).not.toContain(accountId)
    expect(fakeNames(state, 'gh/secrets')).toEqual([])
    expect(fakeNames(state, 'fly/apps')).toEqual([])
  })
})
