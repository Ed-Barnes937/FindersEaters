// `sources.json`: where each pinned source comes from and its checksum
// (docs/spec/food-knowledge-base.md sections 2 and 8).
import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const sha256 = z.string().regex(/^[0-9a-f]{64}$/, 'a lowercase hex SHA-256')
const gitPin = z.strictObject({
  repo: z.string().min(1),
  commit: z.string().regex(/^[0-9a-f]{40}$/, 'a full git commit SHA'),
  path: z.string().min(1),
  url: z.url(),
  sha256,
})

export const sourcePinsSchema = z.strictObject({
  off: gitPin,
  intake24: gitPin,
  usda: z.strictObject({ release: z.string().min(1), url: z.url(), sha256 }),
})

export type SourcePins = z.infer<typeof sourcePinsSchema>

export async function readSourcePins(path: string): Promise<SourcePins> {
  const parsed = sourcePinsSchema.safeParse(JSON.parse(await readFile(path, 'utf8')))
  if (!parsed.success) {
    throw new Error(`${path} is not a valid sources file: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}
