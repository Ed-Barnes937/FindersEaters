// The shared offline plumbing (docs/spec/v0.1.md section 4, auth.md section 6):
// mutations persist and pause offline, survive a reload and replay on
// reconnect; signing out clears the persisted cache and queue.
import 'fake-indexeddb/auto'

import { onlineManager } from '@tanstack/react-query'
import { persistQueryClient } from '@tanstack/react-query-persist-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { clearOfflineState, createOfflineClient, PERSIST_MAX_AGE_MS } from './offline-client.ts'

const KEY = ['probe']

let sent: unknown[]
beforeEach(() => {
  sent = []
  onlineManager.setOnline(true)
  indexedDB = new IDBFactory()
})

/** The app as main.tsx wires it: restore, then persist every change. */
async function app(name: string, probe?: (vars: unknown) => Promise<unknown>) {
  const client = createOfflineClient({
    dbName: name,
    retryDelay: () => 1, // a tiny backoff so the retry test is quick
    mutations: {
      probe:
        probe ??
        ((vars) => {
          sent.push(vars)
          return Promise.resolve()
        }),
    },
  })
  const [stopPersisting, restored] = persistQueryClient({ ...client, maxAge: PERSIST_MAX_AGE_MS })
  client.queryClient.mount() // what QueryClientProvider does: resume on reconnect
  await restored // the subscription starts once the restore settles
  return { ...client, stopPersisting }
}

describe('offline mutation queue', () => {
  it('pauses a mutation while offline and sends it on reconnect', async () => {
    const { queryClient } = await app('a')
    onlineManager.setOnline(false)

    void queryClient.getMutationCache().build(queryClient, { mutationKey: KEY }).execute({ n: 1 })
    await vi.waitFor(() =>
      expect(queryClient.getMutationCache().getAll()[0]?.state.isPaused).toBe(true),
    )
    expect(sent).toEqual([])

    onlineManager.setOnline(true)
    await vi.waitFor(() => expect(sent).toEqual([{ n: 1 }]))
  })

  it('survives a reload: a fresh client restores the queued mutation and replays it', async () => {
    const first = await app('b')
    onlineManager.setOnline(false)
    void first.queryClient
      .getMutationCache()
      .build(first.queryClient, { mutationKey: KEY })
      .execute({ n: 2 })
    await vi.waitFor(async () => {
      expect(await first.persister.restoreClient()).toBeDefined()
      expect((await first.persister.restoreClient())?.clientState.mutations).toHaveLength(1)
    })
    first.stopPersisting() // the page goes away
    first.queryClient.clear()

    const second = await app('b')
    expect(sent).toEqual([])
    onlineManager.setOnline(true)
    await second.queryClient.resumePausedMutations()

    expect(sent).toEqual([{ n: 2 }])
  })
})

describe('replay failures', () => {
  it('keeps a queued mutation when the first replay hits a network error, and sends it once on retry', async () => {
    let attempts = 0
    const { queryClient, persister } = await app('e', (vars) => {
      attempts++
      if (attempts === 1) return Promise.reject(new TypeError('Failed to fetch'))
      sent.push(vars)
      return Promise.resolve()
    })

    void queryClient.getMutationCache().build(queryClient, { mutationKey: KEY }).execute({ n: 3 })

    await vi.waitFor(() => expect(sent).toEqual([{ n: 3 }]))
    expect(attempts).toBe(2)
    await vi.waitFor(async () =>
      expect((await persister.restoreClient())?.clientState.mutations ?? []).toHaveLength(0),
    )
  })

  it('does not retry a 4xx', async () => {
    let attempts = 0
    const { queryClient } = await app('f', () => {
      attempts++
      return Promise.reject(Object.assign(new Error('Bad Request'), { status: 400 }))
    })
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: KEY })
      .execute({})
      .catch(() => undefined)
    expect(attempts).toBe(1)
  })
})

describe('sign out', () => {
  it('clears the persisted cache and the queue', async () => {
    const a = await app('c')
    onlineManager.setOnline(false)
    a.queryClient.setQueryData(['recipes'], ['secret'])
    void a.queryClient.getMutationCache().build(a.queryClient, { mutationKey: KEY }).execute({})
    await vi.waitFor(async () =>
      expect((await a.persister.restoreClient())?.clientState.mutations).toHaveLength(1),
    )

    await clearOfflineState(a)

    expect(a.queryClient.getQueryData(['recipes'])).toBeUndefined()
    expect(a.queryClient.getMutationCache().getAll()).toEqual([])
    expect(await a.persister.restoreClient()).toBeUndefined()
  })
})

describe('launching offline', () => {
  it('starts offline when the browser is offline, so a restored queue is not retried into a dead network', () => {
    const onLine = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    try {
      createOfflineClient({ dbName: 'd', mutations: {} })
      expect(onlineManager.isOnline()).toBe(false)
    } finally {
      onLine.mockRestore()
    }
  })
})
