// The service worker: serves the app shell offline (docs/spec/v0.1.md
// section 4). Built by vite-plugin-pwa (injectManifest), which fills
// `self.__WB_MANIFEST` with the build's files.
//
// A new version installs in the background and WAITS: there is deliberately no
// `skipWaiting()` and no `clients.claim()`, so it only takes over when every
// tab and the installed app have closed, i.e. on the next launch, never
// mid-session (docs/spec/v0.1.md section 15).
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>
}

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Any client-side route loads the cached shell. The API is never the shell:
// those requests, and every non-GET, go straight to the network.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api(\/|$)/, /^\/trpc(\/|$)/, /^\/health$/],
  }),
)
