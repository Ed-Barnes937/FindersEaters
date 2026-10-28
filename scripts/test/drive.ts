// Drives scripts/provision.sh the way the owner does: it reads the prompt the
// wizard is waiting on and types the answer. A prompt is the text after the
// last newline once the wizard stops writing (every `read` follows a printf
// with no newline). An unanswered prompt fails the run with the transcript.
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const scriptsDir = resolve(import.meta.dirname, '..')
export const wizard = join(scriptsDir, 'provision.sh')

export interface Reply {
  prompt: RegExp
  reply: string
}

export interface Run {
  code: number | null
  output: string
}

/** Answers every plain "press Enter" pause and keeps remembered values. */
const enter: Reply = { prompt: /Enter|Ready to start\?/, reply: '' }

export function newState(): string {
  return mkdtempSync(join(tmpdir(), 'fe-provision-'))
}

export async function runWizard(
  args: string[],
  replies: Reply[],
  options: { state: string; env?: Record<string, string>; idleMs?: number },
): Promise<Run> {
  const child = spawn('bash', [wizard, ...args], {
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      HOME: options.state,
      TERM: 'dumb',
      PROVISION_FAKE_STATE: options.state,
      PROVISION_POLL_SECONDS: '0',
      ...options.env,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const rules = [...replies, enter]
  let output = ''
  let pending = ''
  let idle: NodeJS.Timeout | undefined
  let stuck: string | undefined

  const answer = () => {
    const tail = pending.slice(pending.lastIndexOf('\n') + 1)
    if (tail.trim() === '') return
    const rule = rules.find((r) => r.prompt.test(tail))
    if (!rule) {
      clearTimeout(idle)
      idle = setTimeout(() => {
        stuck = tail
        child.kill()
      }, options.idleMs ?? 2_000)
      return
    }
    clearTimeout(idle)
    pending = ''
    // `output` holds only what the wizard printed: a terminal would echo a
    // visible answer, but tests check that hidden ones never appear.
    child.stdin.write(`${rule.reply}\n`)
  }

  const onData = (chunk: Buffer) => {
    const text = chunk.toString()
    output += text
    pending += text
    answer()
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  child.stdin.on('error', () => {})

  const code = await new Promise<number | null>((done) => child.on('close', done))
  clearTimeout(idle)
  if (stuck !== undefined) {
    throw new Error(`No reply for prompt ${JSON.stringify(stuck)}. Transcript:\n${output}`)
  }
  return { code, output }
}

/** Every command the fakes received, one line each: `<tool> <args...>`. */
export function calls(state: string): string[] {
  const log = join(state, 'calls.log')
  return existsSync(log) ? readFileSync(log, 'utf8').trimEnd().split('\n') : []
}

/** A call that makes something new or deploys: none may happen on a rerun. */
export const creates =
  /^(neonctl (projects|branches) create|fly (apps create|tokens create|storage create|certs add|ssh console)|gh workflow run)/

/** A value the fakes hold, e.g. fake(state, 'gh/secrets/FLY_API_TOKEN_STAGING'). */
export function fake(state: string, path: string): string | undefined {
  const file = join(state, 'fake', path)
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined
}

export function fakeNames(state: string, dir: string): string[] {
  const path = join(state, 'fake', dir)
  return existsSync(path) ? readdirSync(path).sort() : []
}
