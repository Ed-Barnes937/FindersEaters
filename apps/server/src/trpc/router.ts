// The tRPC API. Every procedure is a `householdProcedure`: it acts for
// `ctx.principal` and takes no household id from input.
import { getHousehold, getHouseholdMember } from '@finders-eaters/db'
import { TRPCError } from '@trpc/server'

import { householdProcedure, router } from './trpc.ts'

export const appRouter = router({
  account: router({
    /** The signed-in user and their household: what the app shows as "you". */
    me: householdProcedure.query(async ({ ctx: { db, principal } }) => {
      const [member, home] = await Promise.all([
        getHouseholdMember(db, principal.householdId, principal.userId),
        getHousehold(db, principal.householdId),
      ])
      if (!member || !home)
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Account not set up' })
      return {
        user: { id: member.id, name: member.name, email: member.email },
        household: { id: home.id, name: home.name, defaultServings: home.defaultServings },
      }
    }),
  }),
})

export type AppRouter = typeof appRouter
