// The shared offline plumbing later slices build on (docs/spec/v0.1.md
// section 4): a TanStack Query client whose mutations persist to IndexedDB,
// pause while offline and replay on reconnect, and whose cache and queue are
// cleared on sign out (docs/spec/auth.md section 6).
//
// A mutation survives a reload only if it can be rebuilt from its key, so
// every persistable mutation is registered here by name (its key is
// `[name]`) with a function of its variables alone.
import { onlineManager, QueryClient } from '@tanstack/react-query'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'
import { createStore, del, get, set } from 'idb-keyval'

export type MutationFn = (variables: never) => Promise<unknown>

export interface OfflineClientOptions {
  /** IndexedDB database name; one per app, a different one per test. */
  dbName: string
  /** Persistable mutations by name. */
  mutations: Record<string, MutationFn>
}

export interface OfflineClient {
  queryClient: QueryClient
  persister: Persister
}

/** Persisted state older than this is dropped on restore, queue included. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

const RECORD_KEY = 'client'

function idbPersister(dbName: string): Persister {
  const store = createStore(dbName, 'query-cache')
  return {
    persistClient: (client: PersistedClient) => set(RECORD_KEY, client, store),
    restoreClient: () => get<PersistedClient>(RECORD_KEY, store),
    removeClient: () => del(RECORD_KEY, store),
  }
}

export function createOfflineClient({ dbName, mutations }: OfflineClientOptions): OfflineClient {
  // TanStack assumes online until the first online/offline event, so an app
  // launched offline would retry its restored queue into a dead network and
  // drop it. Start from what the browser says.
  onlineManager.setOnline(navigator.onLine)
  const queryClient = new QueryClient({
    // gcTime must outlive the persisted max age or restored entries are
    // collected straight away.
    defaultOptions: { queries: { gcTime: PERSIST_MAX_AGE_MS } },
  })
  for (const [name, mutationFn] of Object.entries(mutations)) {
    queryClient.setMutationDefaults([name], { mutationFn })
  }
  return { queryClient, persister: idbPersister(dbName) }
}

/** Sign out: nothing of the previous library or its queued changes is left. */
export async function clearOfflineState({ queryClient, persister }: OfflineClient): Promise<void> {
  queryClient.clear()
  await persister.removeClient()
}
