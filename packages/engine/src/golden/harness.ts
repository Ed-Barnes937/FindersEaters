import { EngineOutput, type DecisionSource } from '../output.ts'
import { run, type EngineDeps } from '../run.ts'
import { normalise, originalSpan } from '../stages/normalise.ts'
import { engineVersion } from '../config.ts'
import { linesOf, type GoldenLine, type GoldenSet, type GoldenSetName } from './golden-set.ts'

/**
 * The golden-set harness: runs the engine over one set's lines and scores each
 * stage's fields against the labels. It reports; it decides nothing. Dev mode
 * (`set: 'dev'`) never hands a held-out line to the engine, so the canary (#66)
 * can reuse it to send only dev requests live.
 */

export interface FieldScore {
  field: string
  n: number
  correct: number
  wrong: number
  /** No rung decided it: Clef was not asked or not available, or the stage is a stub. */
  unknown: number
  /** How the decided (right or wrong) values were decided. */
  bySource: Partial<Record<DecisionSource, number>>
}

export interface Miss {
  id: string
  field: string
  expected: unknown
  got: unknown
  source: DecisionSource
}

export interface GoldenReport {
  set: GoldenSetName
  lines: number
  engine: {
    version: string
    modelId: string
    answerFingerprint: string | null
    confidenceFormula: string
    framingVersion: string
  }
  runs: { complete: number; partial: number }
  fields: FieldScore[]
  /** Each wrong answer, for dev only: held-out misses are counted, never listed, so nothing is tuned on them. */
  misses: Miss[] | null
}

const FIELDS = [
  'normalise.spans',
  'segment.role',
  'segment.structure',
  'classify.kind',
  'extract.quantity',
  'extract.unit',
  'extract.size',
  'extract.ingredient',
  'extract.prep',
  'extract.note',
  'resolve.ingredient',
  'resolve.unit_system',
] as const
type Field = (typeof FIELDS)[number]

type Got = { source: DecisionSource | null; value: unknown }

export async function runGolden(
  golden: GoldenSet,
  set: GoldenSetName,
  deps: EngineDeps,
): Promise<GoldenReport> {
  const lines = linesOf(golden, set)
  const scores = new Map<Field, FieldScore>(
    FIELDS.map((field) => [field, { field, n: 0, correct: 0, wrong: 0, unknown: 0, bySource: {} }]),
  )
  const misses: Miss[] = []
  const runs = { complete: 0, partial: 0 }

  const record = (item: GoldenLine, field: Field, got: Got, expected: unknown, ok: boolean) => {
    const score = scores.get(field)!
    score.n += 1
    if (got.source === null) {
      score.unknown += 1
      return
    }
    score.bySource[got.source] = (score.bySource[got.source] ?? 0) + 1
    if (ok) {
      score.correct += 1
      return
    }
    score.wrong += 1
    misses.push({ id: item.id, field, expected, got: got.value, source: got.source })
  }

  const outputs = await Promise.all(lines.map((item) => run(sourceFor(item), [], deps)))
  lines.forEach((item, i) => {
    const output = EngineOutput.parse(outputs[i])
    runs[output.runStatus] += 1
    const line = output.lines[0]!
    const part = line.parts[0]

    if (item.fields) {
      const lost = Object.values(item.fields).find(
        (span) => span !== null && !survivesNormalise(item.line, line, span),
      )
      record(
        item,
        'normalise.spans',
        { source: 'rule', value: line.normalised },
        lost,
        lost === undefined,
      )
    }

    const role: Got = line.role
    record(item, 'segment.role', role, item.role, role.value === item.role)
    if (item.role !== 'ingredient') return

    if (item.compound) {
      const split: Got = line.split ?? { source: null, value: null }
      record(item, 'segment.structure', split, item.compound, split.value === item.compound)
    }
    const kind: Got = part?.kind ?? { source: null, value: null }
    if (item.kind) record(item, 'classify.kind', kind, item.kind, kind.value === item.kind)

    if (item.fields && item.compound === 'single' && item.kind !== 'not_ingredient') {
      for (const [name, expected] of Object.entries(item.fields)) {
        const got: Got = part
          ? part[name as keyof typeof item.fields]
          : { source: null, value: null }
        record(item, `extract.${name}` as Field, got, expected, spanMatches(got.value, expected))
      }
    }
    if (item.resolve) {
      const got: Got = part?.resolution ?? { source: null, value: null }
      const expected = [item.resolve.expected].flat()
      record(
        item,
        'resolve.ingredient',
        got,
        item.resolve.expected,
        expected.some((e) => e === got.value),
      )
    }
    if (item.unit_system) {
      const got: Got = output.recipe.unitSystem
      record(item, 'resolve.unit_system', got, item.unit_system, got.value === item.unit_system)
    }
  })

  const { config } = deps
  return {
    set,
    lines: lines.length,
    engine: {
      version: engineVersion(config),
      modelId: config.model.id,
      answerFingerprint: config.model.answerFingerprint,
      confidenceFormula: config.confidenceFormula,
      framingVersion: config.framing.version,
    },
    runs,
    fields: [...scores.values()],
    misses: set === 'dev' ? misses : null,
  }
}

/** Each golden line runs as a one-line source document, as the spike measured lines. */
function sourceFor(item: GoldenLine) {
  return {
    title: item.id,
    ingredientLines: [{ text: item.line }],
    method: [],
    yield: null,
    times: {},
    sourceDomain: item.source.includes('.') ? item.source : null,
  }
}

/**
 * A golden span survives normalise when its normalised form is in the
 * normalised line and maps back through the offset map to original text that
 * normalises to the same thing. A list of spans survives if any one does.
 */
function survivesNormalise(
  original: string,
  line: EngineOutput['lines'][number],
  span: string | (string | null)[],
): boolean {
  const options = [span].flat().filter((option) => option !== null)
  const haystack = line.normalised.toLowerCase()
  return options.some((option) => {
    const needle = normalise(option).text.toLowerCase()
    if (!needle) return false
    for (
      let start = haystack.indexOf(needle);
      start >= 0;
      start = haystack.indexOf(needle, start + 1)
    ) {
      const back = originalSpan(original, line, start, start + needle.length)
      if (normalise(back).text.toLowerCase() === needle) return true
    }
    return false
  })
}

/** Golden span equality, as the spike graded it: case and punctuation ignored. */
function spanMatches(got: unknown, expected: string | (string | null)[] | null): boolean {
  const norm = (s: unknown) =>
    typeof s === 'string' ? s.toLowerCase().replace(/[^\p{L}\p{N}½¼¾⅓⅔⅛⅜⅝⅞]/gu, '') || null : null
  return [expected].flat().some((option) => norm(option) === norm(got))
}

export function formatReport(report: GoldenReport): string {
  const { engine } = report
  const out = [
    `## Golden set: ${report.set} (${report.lines} lines)`,
    '',
    `Engine \`${engine.version}\`, model \`${engine.modelId}\`, answer fingerprint ${
      engine.answerFingerprint ? `\`${engine.answerFingerprint}\`` : 'not baselined'
    }, confidence formula \`${engine.confidenceFormula}\`, framing \`${engine.framingVersion}\`. ` +
      `Runs: ${report.runs.complete} complete, ${report.runs.partial} partial.`,
    '',
    '| Field | n | right | wrong | unknown | accuracy | rule | model | correction |',
    '|---|---|---|---|---|---|---|---|---|',
    ...report.fields.map(
      (f) =>
        `| ${f.field} | ${f.n} | ${f.correct} | ${f.wrong} | ${f.unknown} | ${
          f.n ? (f.correct / f.n).toFixed(2) : '-'
        } | ${f.bySource.rule ?? 0} | ${f.bySource.model ?? 0} | ${f.bySource.correction ?? 0} |`,
    ),
  ]
  if (report.misses?.length) {
    out.push(
      '',
      '### Misses',
      '',
      '| Line | Field | Expected | Got | Source |',
      '|---|---|---|---|---|',
    )
    for (const m of report.misses) {
      out.push(
        `| ${m.id} | ${m.field} | ${JSON.stringify(m.expected)} | ${JSON.stringify(m.got)} | ${m.source} |`,
      )
    }
  }
  return `${out.join('\n')}\n`
}
