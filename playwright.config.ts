import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Un test type = login (~10 s) + chargement d'une page qui enchaîne plusieurs
  // requêtes vers l'API Docker (~10-20 s sur Windows). 30 s était trop juste et
  // rendait la suite intermittente.
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: 0,
  // Sérialisé volontairement. À 3 workers, la suite saturait l'API Docker sur
  // Windows : le POST de login restait en attente au-delà de 15 s et une dizaine
  // de tests échouaient en cascade, avec des symptômes qui ressemblaient à des
  // bugs applicatifs. Le goulot est le backend, pas le navigateur — paralléliser
  // ne fait donc rien gagner ici.
  workers: 1,
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
