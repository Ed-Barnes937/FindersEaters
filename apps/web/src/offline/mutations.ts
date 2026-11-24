// Every persistable mutation, by name (see offline-client.ts). Slices add
// theirs here as they land (shopping ticks, share target).
import type { MutationFn } from './offline-client.ts'

export const mutations = {
  /**
   * Infrastructure probe for the offline queue's end-to-end test: POSTs the
   * variables to a path no server route answers. Remove when the first real
   * mutation lands and the test can use it.
   */
  'offline-probe': async (variables: { id: string }) => {
    const res = await fetch('/api/offline-probe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(variables),
    })
    if (!res.ok) throw new Error(`offline-probe failed: ${res.status}`)
  },
} satisfies Record<string, MutationFn>
