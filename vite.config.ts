/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

// The live site sits behind Netlify visitor access. iOS fetches the home-screen
// icon without the visitor's login, so the icon is embedded in the page instead.
function inlineAppleTouchIcon(): Plugin {
  const href = '/icons/apple-touch-icon-180x180.png';
  return {
    name: 'inline-apple-touch-icon',
    apply: 'build',
    transformIndexHtml(html) {
      const png = readFileSync(new URL(`./public${href}`, import.meta.url)).toString('base64');
      return html.replace(`href="${href}"`, `href="data:image/png;base64,${png}"`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    inlineAppleTouchIcon(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Crochet Tracker',
        short_name: 'Crochet',
        start_url: '/',
        display: 'standalone',
        theme_color: '#E4EEF9',
        background_color: '#E4EEF9',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: { port: 7420, strictPort: true },
  preview: { port: 7420, strictPort: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
