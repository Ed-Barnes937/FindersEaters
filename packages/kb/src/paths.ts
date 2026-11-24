// Where the package keeps its files. Resolved from this file, so the commands
// work from any working directory.
import { fileURLToPath } from 'node:url'

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))

export const defaults = {
  sources: here('../sources.json'),
  own: here('../own'),
  /** Raw downloads, cached by checksum and never committed. */
  cache: here('../.cache'),
  /** The built artifact: written by `kb build`, copied into the image, read by the release step. */
  artifact: here('../dist/kb.json.gz'),
}
