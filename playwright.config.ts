import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    // cookies sont gérés automatiquement (credentials: include via Vite proxy)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Le dev server doit être démarré manuellement avant de lancer les tests
  // webServer n'est pas configuré ici pour ne pas démarrer automatiquement
  // en production CI — lancer `npm run dev` séparément si besoin
})
