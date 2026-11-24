// Name normalisation for the KB: lowercase, accents stripped, one space. The
// read-side name index (singular forms and so on) builds on this.

/** Lowercase, accent-free, single-spaced. */
export function normaliseName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** A slug in the Open Food Facts style: `Tomato purée` becomes `tomato-puree`. */
export function slugify(name: string): string {
  return normaliseName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
