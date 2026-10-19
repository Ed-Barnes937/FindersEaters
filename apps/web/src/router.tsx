import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'

import { PlaceholderPage } from './pages/PlaceholderPage.tsx'

const rootRoute = createRootRoute({ component: Outlet })

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: PlaceholderPage,
})

const routeTree = rootRoute.addChildren([indexRoute])

// Until real screens land (each gated on its design in docs/design-reference),
// every path shows the placeholder.
export const router = createRouter({ routeTree, defaultNotFoundComponent: PlaceholderPage })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
