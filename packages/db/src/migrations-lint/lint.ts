// The destructive-statement lint (docs/spec/operations.md section 4, rule 4).
// A migration must be expand-only unless it carries a `-- contract: <what and
// why>` line, so the previous release's code keeps working against it.

export type DestructiveRule = 'DROP' | 'RENAME' | 'ALTER ... TYPE' | 'SET NOT NULL'

export interface Violation {
  rule: DestructiveRule
  /** 1-based line of the offending keyword in the migration file. */
  line: number
}

const CONTRACT_LINE = /^[ \t]*--[ \t]*contract:[ \t]*\S/im

// Enum value removal has no statement of its own in Postgres: it is a DROP TYPE
// and a re-create, so the DROP rule covers it. `DROP NOT NULL` relaxes a
// constraint, which the previous release's code tolerates, so it is expand.
const RULES: ReadonlyArray<{ rule: DestructiveRule; pattern: RegExp }> = [
  { rule: 'DROP', pattern: /\bDROP\b(?!\s+NOT\s+NULL\b)/gi },
  { rule: 'RENAME', pattern: /\bRENAME\b/gi },
  { rule: 'ALTER ... TYPE', pattern: /\bALTER\s+COLUMN\s+\S+\s+(?:SET\s+DATA\s+)?TYPE\b/gi },
  { rule: 'SET NOT NULL', pattern: /\bSET\s+NOT\s+NULL\b/gi },
]

/** Lints one migration's SQL. An empty result means the migration may ship. */
export function lintMigration(sql: string): Violation[] {
  if (CONTRACT_LINE.test(sql)) return []
  const code = maskNonCode(sql)
  const violations: Violation[] = []
  for (const { rule, pattern } of RULES) {
    for (const match of code.matchAll(pattern)) {
      violations.push({ rule, line: lineAt(code, match.index) })
    }
  }
  return violations.sort((a, b) => a.line - b.line)
}

/**
 * Blanks out comments and string literals, and turns quoted identifiers into
 * plain word characters, so only SQL keywords are left to match. Newlines are
 * kept, so offsets still map to lines.
 */
function maskNonCode(sql: string): string {
  const nonCode = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"/g
  return sql.replace(nonCode, (text) => text.replace(/[^\n]/g, text.startsWith('"') ? '_' : ' '))
}

function lineAt(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset; i++) if (text[i] === '\n') line++
  return line
}
