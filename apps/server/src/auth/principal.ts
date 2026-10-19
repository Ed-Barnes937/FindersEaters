// Who a request acts as (docs/spec/auth.md section 5). Each transport resolves
// its credentials here once; handlers and the data-access layer see only the
// principal and never take a household id, user id or token from input.
import { householdIdOfUser, type Db } from '@finders-eaters/db'

import type { Auth } from './auth.ts'

/**
 * A signed-in user. The import-token principal (`kind: "importToken"`) joins
 * this union with the import route.
 */
export interface UserPrincipal {
  kind: 'user'
  userId: string
  householdId: string
  sessionId: string
}

export type Principal = UserPrincipal

/**
 * The result of resolving a session: none, a user with no household (only a
 * half-run CLI causes it), or a principal.
 */
export type SessionResolution =
  { status: 'anonymous' } | { status: 'noHousehold' } | { status: 'ok'; principal: UserPrincipal }

/** Resolves a request's session cookie, reading the session row every time. */
export async function resolveSession(
  auth: Auth,
  db: Db,
  headers: Headers,
): Promise<SessionResolution> {
  const found = await auth.api.getSession({ headers })
  if (!found) return { status: 'anonymous' }
  const householdId = await householdIdOfUser(db, found.user.id)
  if (!householdId) return { status: 'noHousehold' }
  return {
    status: 'ok',
    principal: {
      kind: 'user',
      userId: found.user.id,
      householdId,
      sessionId: found.session.id,
    },
  }
}
