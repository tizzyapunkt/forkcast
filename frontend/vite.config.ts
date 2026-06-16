import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

// HTTPS (self-signed) is on by default for PWA/install testing. Set FORKCAST_NO_HTTPS=1
// to serve over plain http:// — smoother for browser smoke testing (no cert warning to
// click through, and the Chrome automation tools don't choke on the self-signed cert).
const disableHttps = process.env.FORKCAST_NO_HTTPS === '1' || process.env.FORKCAST_NO_HTTPS === 'true';

export default defineConfig({
  plugins: [
    ...(disableHttps ? [] : [basicSsl()]),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'forkcast',
        short_name: 'forkcast',
        description: 'Wochenplanung und Ernährungstagebuch',
        display: 'standalone',
        background_color: '#fff9ff',
        theme_color: '#4e489a',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
