import type { Page } from '@playwright/test'

export const DEMO_CREDENTIALS = {
  stagiaire:   { email: 'stagiaire@auxilium.test',   password: 'Test1234!' },
  formateur:   { email: 'formateur@auxilium.test',   password: 'Test1234!' },
  directeur:   { email: 'directeur@auxilium.test',   password: 'Test1234!' },
  stagiaire2:  { email: 'stagiaire2@auxilium.test',  password: 'Test1234!' },
}

export async function loginAs(page: Page, role: keyof typeof DEMO_CREDENTIALS) {
  const { email, password } = DEMO_CREDENTIALS[role]
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  // PrimeVue v4 <Password inputId="password"> place l'id sur l'input interne
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  // Attend la redirection vers le dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}
