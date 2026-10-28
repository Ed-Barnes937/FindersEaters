// End-to-end tests run against the production build: the Fastify server
// serving the built SPA from `dist`, on the 390 px mobile viewport
// (docs/spec/v0.1.md section 17.2). Retries are 0: a flaky test is a bug.
import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
// The CI service container, or Docker Compose locally (README "Test").
const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/finders_eaters'

export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  // Started the way a deploy starts it: the release step, then the server.
  // Ready when `/health` makes its database round-trip.
  webServer: {
    command: 'node ../server/src/cli.ts release && node ../server/src/main.ts',
    url: `http://localhost:${PORT}/health`,
    env: {
      PORT: String(PORT),
      STATIC_DIR: 'dist',
      DATABASE_URL,
      DATABASE_URL_DIRECT: DATABASE_URL,
    },
    reuseExistingServer: false,
  },
})
