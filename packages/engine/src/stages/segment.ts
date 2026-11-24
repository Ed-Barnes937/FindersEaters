import type { EngineConfig } from '../config.ts'
import type { Role } from '../output.ts'
import type { SourceLine } from '../source.ts'

type SegmentRules = EngineConfig['rules']['segment']

/**
 * Stage 2, segment: the role rule (docs/spec/engine-pipeline.md section 3). A
 * captured heading, a trailing colon or a "For the ..." line is a header; a
 * line starting with a number is an ingredient. Anything else is Clef's.
 */
export function roleByRule(line: SourceLine, text: string, rules: SegmentRules): Role | null {
  if (line.heading) return 'header'
  if (text.endsWith(':')) return 'header'
  const lower = text.toLowerCase()
  if (rules.headerPrefixes.some((prefix) => lower.startsWith(prefix))) return 'header'
  if (/^\d/.test(text)) return 'ingredient'
  return null
}

/** Where the line could split into parts: split words and split marks, as [start, end). */
export function splitPoints(text: string, rules: SegmentRules): [number, number][] {
  const points: [number, number][] = []
  const lower = text.toLowerCase()
  for (const word of rules.splitWords) {
    for (const match of lower.matchAll(
      new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'gu'),
    )) {
      points.push([match.index, match.index + word.length])
    }
  }
  for (const mark of rules.splitMarks) {
    for (const match of lower.matchAll(new RegExp(escape(mark), 'g'))) {
      // Normalise writes fractions as n/d: a slash between digits is a number, not a split.
      const isFraction =
        mark === '/' &&
        /\d/.test(lower[match.index - 1] ?? '') &&
        /\d/.test(lower[match.index + 1] ?? '')
      if (!isFraction) points.push([match.index, match.index + mark.length])
    }
  }
  return points.sort((a, b) => a[0] - b[0])
}

export function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
}
