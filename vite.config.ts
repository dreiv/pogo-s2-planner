import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'],
      manifest: {
        name: 'Pogo S2 Planner',
        short_name: 'S2 Planner',
        description: 'Grile S2 (14/17) + ocupare Pokéstop/Gym din export Wayfarer',
        lang: 'en',
        start_url: '.',
        display: 'standalone',
        background_color: '#111827',
        theme_color: '#111827',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Cache ONLY the app shell (JS/CSS/HTML). Never cache OSM tiles
        // (OSM tile policy) or any data endpoints.
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.js', '**/*.css', '**/*.html'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/tiles\//, /^\/data\//],
        runtimeCaching: [
          {
            // Map tiles (OSM): network-only, never persisted
            // (tile policy — no caching of third-party tiles).
            urlPattern: ({ url }) => url.hostname === 'tile.openstreetmap.org',
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom',
    pool: 'forks'
  }
})
