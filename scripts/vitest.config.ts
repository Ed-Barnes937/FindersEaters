import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Each wizard run is a real bash process driven over stdin and stdout.
    testTimeout: 60_000,
  },
})
