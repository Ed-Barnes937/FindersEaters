// Golden-set report: `pnpm --filter @finders-eaters/engine golden [--set dev|heldout|all] [--json <file>]`.
// Prints a markdown report per set (dev and held-out separately) and exits 1
// if the engine throws or produces output that fails its schema. It reports;
// the pass rule that gates on these numbers is #44.
//
// Clef: until the cassette client lands (#41), every Clef-dependent decision
// is unknown here, so the numbers are what the pin and rule rungs settle.
import { writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { defaultConfig } from '../config.ts'
import { unavailableClef } from '../testing.ts'
import {
  formatReport,
  loadGolden,
  runGolden,
  type GoldenReport,
  type GoldenSetName,
} from './index.ts'

const { values } = parseArgs({
  options: {
    set: { type: 'string', default: 'all' },
    golden: { type: 'string' },
    json: { type: 'string' },
  },
})

const sets: GoldenSetName[] =
  values.set === 'all'
    ? ['dev', 'heldout']
    : values.set === 'dev' || values.set === 'heldout'
      ? [values.set]
      : []
if (sets.length === 0) {
  console.error(`--set must be dev, heldout or all, not ${values.set}`)
  process.exit(2)
}

const golden = loadGolden(values.golden)
// No knowledge base snapshot yet (#38): nothing reads it until resolution (#43).
const deps = { kb: { version: 'none' }, clef: unavailableClef, config: defaultConfig }
const reports: GoldenReport[] = []
for (const set of sets) reports.push(await runGolden(golden, set, deps))

process.stdout.write('Clef: none (rules only until the cassette client, #41).\n\n')
process.stdout.write(reports.map(formatReport).join('\n'))
if (values.json) writeFileSync(values.json, `${JSON.stringify(reports, null, 2)}\n`)
