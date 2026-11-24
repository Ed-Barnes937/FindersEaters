/**
 * Stage 1, normalise (docs/spec/engine-pipeline.md section 3): rule only, and
 * it cannot fail. Decodes entities, applies Unicode NFKC, writes vulgar
 * fractions as `n/d`, unifies dashes and quotes, strips bullets and list
 * numbering and collapses whitespace, keeping an offset map back to the
 * original line for highlighting.
 */

export interface Normalised {
  text: string
  /** For each character of `text`, the [start, end) range of the original it came from. */
  offsets: [number, number][]
}

interface Char {
  ch: string
  start: number
  end: number
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  deg: '°',
  times: '×',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  frac13: '⅓',
  frac23: '⅔',
  frac15: '⅕',
  frac25: '⅖',
  frac35: '⅗',
  frac45: '⅘',
  frac16: '⅙',
  frac56: '⅚',
  frac18: '⅛',
  frac38: '⅜',
  frac58: '⅝',
  frac78: '⅞',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  iuml: 'ï',
  ouml: 'ö',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
}

const DASHES = /[‐-―−﹘﹣－]/g
const SINGLE_QUOTES = /[‘-‛′‵]/g
const DOUBLE_QUOTES = /[“-‟″‶]/g
const VULGAR_FRACTION = /^[¼-¾⅐-⅞]$/
const COMBINING_MARK = /^\p{M}$/u
const LEADING_BULLET = /^(?:[•·◦▪▫‣⁃∙●○■□]\s*|[-*]\s+)/
const LIST_NUMBERING = /^\d+[.)]\s+/

/** Entities decoded, as units of text with the original range each came from. */
function decodeEntities(original: string): Char[] {
  const units: Char[] = []
  const entity = /&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/giy
  let i = 0
  while (i < original.length) {
    entity.lastIndex = i
    const match = original[i] === '&' ? entity.exec(original) : null
    const decoded = match ? decodeEntity(match[1]!) : null
    if (match && decoded !== null) {
      units.push({ ch: decoded, start: i, end: i + match[0].length })
      i += match[0].length
      continue
    }
    const codePoint = String.fromCodePoint(original.codePointAt(i)!)
    units.push({ ch: codePoint, start: i, end: i + codePoint.length })
    i += codePoint.length
  }
  return units
}

function decodeEntity(body: string): string | null {
  if (body.startsWith('#x') || body.startsWith('#X'))
    return fromCodePoint(parseInt(body.slice(2), 16))
  if (body.startsWith('#')) return fromCodePoint(parseInt(body.slice(1), 10))
  return NAMED_ENTITIES[body.toLowerCase()] ?? null
}

function fromCodePoint(code: number): string | null {
  return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null
}

/** NFKC per base character and its combining marks, then the house forms. */
function foldCharacters(units: Char[]): Char[] {
  const out: Char[] = []
  let i = 0
  while (i < units.length) {
    const base = units[i]!
    let group = base.ch
    let end = base.end
    i += 1
    while (i < units.length && COMBINING_MARK.test(units[i]!.ch)) {
      group += units[i]!.ch
      end = units[i]!.end
      i += 1
    }
    const isVulgarFraction = VULGAR_FRACTION.test(group)
    let folded = group
      .replace(/[″‶]/g, '"')
      .normalize('NFKC')
      .replace(DASHES, '-')
      .replace(SINGLE_QUOTES, "'")
      .replace(DOUBLE_QUOTES, '"')
      .replace(/⁄/g, '/')
    if (isVulgarFraction && /\d/.test(out.at(-1)?.ch ?? '')) folded = ` ${folded}`
    for (const ch of folded) out.push({ ch, start: base.start, end })
  }
  return out
}

/** Bullets and list numbering off the front, whitespace collapsed and trimmed. */
function tidyLine(chars: Char[]): Char[] {
  let rest = chars
  const dropLeading = (pattern: RegExp) => {
    const text = rest.map((c) => c.ch).join('')
    const match = pattern.exec(text.trimStart())
    if (!match) return
    const skipped = text.length - text.trimStart().length + match[0].length
    // A string index is a code unit index; every Char here is one code unit or a whole surrogate pair.
    let units = 0
    let n = 0
    while (n < rest.length && units < skipped) units += rest[n++]!.ch.length
    rest = rest.slice(n)
  }
  dropLeading(LEADING_BULLET)
  dropLeading(LIST_NUMBERING)

  const out: Char[] = []
  for (const c of rest) {
    if (/\s/.test(c.ch)) {
      const last = out.at(-1)
      if (!last) continue
      if (last.ch === ' ') last.end = c.end
      else out.push({ ch: ' ', start: c.start, end: c.end })
      continue
    }
    out.push(c)
  }
  if (out.at(-1)?.ch === ' ') out.pop()
  return out
}

export function normalise(original: string): Normalised {
  const chars = tidyLine(foldCharacters(decodeEntities(original)))
  return {
    text: chars.map((c) => c.ch).join(''),
    offsets: chars.flatMap((c) =>
      Array.from({ length: c.ch.length }, () => [c.start, c.end] as [number, number]),
    ),
  }
}

/** The text of the original line behind the normalised span [start, end). */
export function originalSpan(
  original: string,
  line: { offsets: readonly (readonly [number, number])[] },
  start: number,
  end: number,
): string {
  if (end <= start) return ''
  const first = line.offsets[start]
  const last = line.offsets[end - 1]
  if (!first || !last) throw new RangeError(`span [${start}, ${end}) is outside the line`)
  return original.slice(first[0], last[1])
}
