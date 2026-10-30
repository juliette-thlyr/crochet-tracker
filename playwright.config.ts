import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:7421' },
  webServer: {
    // "--mode test" makes Vite read .env.test, so the app talks to the local Supabase stack
    command: 'node scripts/copy-pdfjs-assets.mjs && npx vite --mode test --port 7421 --strictPort',
    url: 'http://localhost:7421',
    reuseExistingServer: false,
  },
});
