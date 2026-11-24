import './styles/tokens.css'
import './styles/global.scss'

import { RouterProvider } from '@tanstack/react-router'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { createOfflineClient, PERSIST_MAX_AGE_MS } from './offline/offline-client.ts'
import { mutations } from './offline/mutations.ts'
import { registerServiceWorker } from './offline/register-service-worker.ts'
import { router } from './router.tsx'

const root = document.getElementById('root')
if (!root) throw new Error('missing #root element')

const offline = createOfflineClient({ dbName: 'finders-eaters', mutations })

// The end-to-end test drives the offline queue through this handle (no screen
// has a mutation yet); it grants nothing the page's own script does not have.
;(window as unknown as { __fe: unknown }).__fe = { queryClient: offline.queryClient }

registerServiceWorker()

createRoot(root).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={offline.queryClient}
      persistOptions={{ persister: offline.persister, maxAge: PERSIST_MAX_AGE_MS }}
      onSuccess={() => void offline.queryClient.resumePausedMutations()}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  </StrictMode>,
)
