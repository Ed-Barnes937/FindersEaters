import { createHash } from 'node:crypto'
import { z } from 'zod'
import { LineKind, Role, Split, type Flag } from './output.ts'
import type { SourceDocument } from './source.ts'

/**
 * A pin: a correction as the engine reads it (docs/spec/engine-pipeline.md
 * section 6). A line pin is anchored by the original line's index, a part
 * index (0 for a line that was not split), the field and a hash of the
 * original line text as a guard. A recipe pin is keyed by field.
 */
export const Pin = z.discriminatedUnion('scope', [
  z.object({
    scope: z.literal('line'),
    lineIndex: z.int().min(0),
    partIndex: z.int().min(0),
    lineHash: z.string(),
    field: z.string(),
    value: z.unknown(),
  }),
  z.object({ scope: z.literal('recipe'), field: z.string(), value: z.unknown() }),
])
export type Pin = z.infer<typeof Pin>

/** The anchor guard: SHA-256 (hex) of the original line text. */
export function lineHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

/** The line fields the built stages read pins for, with the values each takes. */
const LINE_FIELDS = { role: Role, split: Split, kind: LineKind } as const
type PinnedLineField = keyof typeof LINE_FIELDS

export interface LinePins {
  role?: Role
  split?: Split
  /** Kind pins by part index. */
  kind: Map<number, LineKind>
}

export interface PinIndex {
  lines: LinePins[]
  /** Pins kept but not applied, as `orphaned_correction` flags. */
  orphaned: Flag[]
}

/**
 * Sorts pins onto the lines they anchor to. A pin whose line text changed,
 * whose part no longer exists or whose value the field does not take is
 * orphaned: kept, not applied, flagged with its old value. Pins for fields of
 * stages not built yet are left alone.
 */
export function indexPins(input: SourceDocument, pins: Pin[]): PinIndex {
  const lines: LinePins[] = input.ingredientLines.map(() => ({ kind: new Map() }))
  const orphaned: Flag[] = []
  for (const pin of pins) {
    if (pin.scope !== 'line' || !(pin.field in LINE_FIELDS)) continue
    const field = pin.field as PinnedLineField
    const line = input.ingredientLines[pin.lineIndex]
    const value = LINE_FIELDS[field].safeParse(pin.value)
    const partIndex = field === 'kind' ? pin.partIndex : 0
    const applies =
      line !== undefined &&
      lineHash(line.text) === pin.lineHash &&
      pin.partIndex === partIndex &&
      // Every line is one part until the split into parts is performed.
      partIndex === 0 &&
      value.success
    if (!applies) {
      orphaned.push({
        target: { scope: 'line', lineIndex: pin.lineIndex, partIndex: pin.partIndex, field },
        code: 'orphaned_correction',
        severity: 'check',
        answer: pin.value,
        alternatives: [],
      })
      continue
    }
    const pinned = lines[pin.lineIndex]!
    if (field === 'role') pinned.role = value.data as Role
    else if (field === 'split') pinned.split = value.data as Split
    else pinned.kind.set(partIndex, value.data as LineKind)
  }
  return { lines, orphaned }
}
