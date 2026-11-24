import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

import { manifest } from './manifest.ts'

export default defineConfig({
  plugins: [
    react(),
    // Hand-written worker (src/sw/sw.ts) with the precache list injected; the
    // page registers it itself (src/offline/register-service-worker.ts).
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src/sw',
      filename: 'sw.ts',
      injectRegister: false,
      manifest,
      manifestFilename: 'manifest.webmanifest',
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,webmanifest}'] },
    }),
  ],
  server: {
    // In dev, the API lives on the Fastify server.
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
    },
  },
})
