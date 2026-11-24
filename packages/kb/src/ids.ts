// Stable surrogate ids. An ingredient's id is a UUIDv5 of its OFF id or its
// own-layer key, so a rebuild from the same inputs mints the same ids without
// carrying state between builds (docs/spec/food-knowledge-base.md section 4).
import { v5 } from 'uuid'

/** Fixed forever: changing it would change every ingredient id. */
const NAMESPACE = '5f1d2c3e-8a47-4b9e-9c1a-0e6b7d2a4f10'

export function offIngredientId(offId: string): string {
  return v5(`off:${offId}`, NAMESPACE)
}

export function ownIngredientId(key: string): string {
  return v5(`own:${key}`, NAMESPACE)
}
