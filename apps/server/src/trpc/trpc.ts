// tRPC setup (docs/spec/auth.md section 5). The context carries the request's
// resolved session; `householdProcedure` is the only procedure builder, so
// every procedure requires a signed-in user and gets its household from the
// principal. There is no public tRPC procedure in V0.1.
import type { Db } from '@finders-eaters/db'
import { initTRPC, TRPCError } from '@trpc/server'

import type { SessionResolution } from '../auth/principal.ts'

export interface Context {
  db: Db
  session: SessionResolution
}

const t = initTRPC.context<Context>().create()

export const router = t.router

export const householdProcedure = t.procedure.use(({ ctx, next }) => {
  switch (ctx.session.status) {
    case 'anonymous':
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' })
    case 'noHousehold':
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Account not set up' })
    case 'ok':
      return next({ ctx: { db: ctx.db, principal: ctx.session.principal } })
  }
})
