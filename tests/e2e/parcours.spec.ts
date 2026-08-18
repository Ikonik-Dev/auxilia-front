import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Parcours stagiaire', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'stagiaire')
  })

  test('page /parcours affiche les modules de la formation', async ({ page }) => {
    await page.goto('/parcours')
    // Attend la fin du chargement (les skeletons disparaissent)
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 30_000 })
    // Au moins un module visible
    const modules = page.locator('.module-block')
    await expect(modules).toHaveCount(7, { timeout: 10_000 }) // DWWM = 7 modules
  })

  test('ouvrir un module affiche ses leçons', async ({ page }) => {
    await page.goto('/parcours')
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 30_000 })

    // Le premier module est ouvert automatiquement
    const firstModule = page.locator('.module-block').first()
    const lessonsContainer = firstModule.locator('.lessons-list')
    await expect(lessonsContainer).toBeVisible()

    // Il doit y avoir des leçons
    const lessonRows = lessonsContainer.locator('.lesson-row')
    await expect(lessonRows.first()).toBeVisible()
  })

  test('cliquer sur une leçon ouvre le Dialog de contenu', async ({ page }) => {
    await page.goto('/parcours')
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 30_000 })

    // Ouvre le premier module
    const firstModule = page.locator('.module-block').first()
    await expect(firstModule.locator('.lessons-list')).toBeVisible()

    // Clic sur la première leçon
    await firstModule.locator('.lesson-row').first().click()

    // Le Dialog doit apparaître
    await expect(page.locator('.p-dialog')).toBeVisible({ timeout: 5_000 })

    // Il doit y avoir au moins le bouton "Terminer la leçon" ou "Marquer comme en cours"
    const hasAction = await page.locator('.lesson-dialog-actions button').count()
    expect(hasAction).toBeGreaterThan(0)
  })

  test('progression globale affichée dans la hero card', async ({ page }) => {
    await page.goto('/parcours')
    await expect(page.locator('.enrollment-hero')).toBeVisible({ timeout: 30_000 })
    // La barre de progression doit être présente
    await expect(page.locator('.hero-progress')).toBeVisible()
  })
})

test.describe('Parcours — formations hors DWWM', () => {
  test('un stagiaire hors DWWM atteint un état terminal, jamais un écran vide', async ({ page }) => {
    // stagiaire2 n'est pas dans DWWM (fixtures : DW — Promotion Hiver 2026).
    // Ses leçons étaient sur la page 2 de /api/lessons avant le fix de pagination.
    await loginAs(page, 'stagiaire2')
    await page.goto('/parcours')

    // /parcours enchaîne 6 requêtes (enrollments → session → modules/leçons/
    // complétions/parcours/jalons) : compter jusqu'à 30 s avant de conclure.
    // ⚠ Ne pas utiliser locator.isVisible({ timeout }) — l'option y est ignorée,
    // le contrôle est immédiat. C'est ce qui rendait ce test instable.
    const terminalStates = '.modules-section, .empty-hero, .others-section, .empty-state, .dash-error'
    await page.waitForSelector(terminalStates, { state: 'visible', timeout: 30_000 })

    // Aucun état terminal ne doit être une erreur
    await expect(page.locator('.dash-error')).toHaveCount(0)

    // L'écran n'est jamais nu : le titre plus au moins un bloc de contenu
    await expect(page.getByRole('heading', { level: 1, name: /mon parcours/i })).toBeVisible()

    if (await page.locator('.modules-section').isVisible()) {
      // S'il y a des modules, le premier ouvert doit contenir des leçons.
      // Pas de count exact : la formation de stagiaire2 dépend des fixtures.
      const firstModuleLessons = page
        .locator('.module-block')
        .first()
        .locator('.lessons-list .lesson-row')
      await expect(firstModuleLessons.first()).toBeVisible()
    }
  })
})
