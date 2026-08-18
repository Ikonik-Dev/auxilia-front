import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Authentification', () => {
  test('login stagiaire → cookie BEARER posé + redirect dashboard', async ({ page }) => {
    await loginAs(page, 'stagiaire')

    // Le localStorage ne doit pas contenir de token JWT
    const ls = await page.evaluate(() => JSON.stringify(localStorage))
    expect(ls).not.toContain('token')
    expect(ls).not.toContain('jwt')

    // On est bien sur le dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('mauvais mot de passe → message d\'erreur visible', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill('stagiaire@auxilium.test')
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe')
    await page.getByRole('button', { name: /se connecter/i }).click()

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 })
    await expect(page).not.toHaveURL(/\/dashboard/)
  })

  test('logout → redirect login + cookies effacés', async ({ page }) => {
    await loginAs(page, 'stagiaire')
    await page.getByRole('button', { name: /déconnexion/i }).click()
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/login/)
  })
})
