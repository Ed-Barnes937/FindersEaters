import { describe, expect, it } from 'vitest'
import { testDeps } from '../testing.ts'
import { loadGolden, runGolden } from './index.ts'

// The dev set only: held-out lines are reported by the golden CI job, never asserted on here.
describe('the rule stages on the dev golden set', () => {
  it('normalise keeps every golden span, and no rule decides a role, structure or kind wrong', async () => {
    const report = await runGolden(loadGolden(), 'dev', testDeps())

    const spans = report.fields.find((f) => f.field === 'normalise.spans')
    expect(spans?.n).toBeGreaterThan(0)
    expect(spans?.correct).toBe(spans?.n)

    const ruleMisses = report.misses?.filter((m) => m.source === 'rule')
    expect(ruleMisses).toEqual([])
    for (const field of ['segment.role', 'segment.structure', 'classify.kind']) {
      expect(report.fields.find((f) => f.field === field)?.bySource.rule, field).toBeGreaterThan(0)
    }
  })
})
