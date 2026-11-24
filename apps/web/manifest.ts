// The web app manifest (docs/spec/v0.1.md section 4). Colours are the light
// `--color-bg` from docs/design-reference/tokens.css (manifest.test.ts keeps
// them in step); the icons are placeholders until the real ones are designed.
import type { ManifestOptions } from 'vite-plugin-pwa'

const BG = '#F6F3EE'

export const manifest: Partial<ManifestOptions> = {
  name: 'Finders Eaters',
  short_name: 'Finders Eaters',
  lang: 'en-GB',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: BG,
  theme_color: BG,
  icons: [
    { src: '/icons/placeholder-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/placeholder-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: '/icons/placeholder-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}
