import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Each wizard run is a real bash process (and many short-lived child
    // processes) driven over stdin and stdout. One file at a time keeps that
    // load from starving the other workspaces' tests, which turbo runs alongside.
    testTimeout: 60_000,
    fileParallelism: false,
  },
})
