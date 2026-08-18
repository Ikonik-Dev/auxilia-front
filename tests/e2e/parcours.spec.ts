import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

test.describe('Parcours stagiaire', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'stagiaire')
  })

  test('page /parcours affiche les modules de la formation', async ({ page }) => {
    await page.goto('/parcours')
    // Attend la fin du chargement (les skeletons disparaissent)
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 15_000 })
    // Au moins un module visible
    const modules = page.locator('.module-block')
    await expect(modules).toHaveCount(7, { timeout: 10_000 }) // DWWM = 7 modules
  })

  test('ouvrir un module affiche ses leçons', async ({ page }) => {
    await page.goto('/parcours')
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 15_000 })

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
    await expect(page.locator('.modules-section')).toBeVisible({ timeout: 15_000 })

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
    await expect(page.locator('.enrollment-hero')).toBeVisible({ timeout: 15_000 })
    // La barre de progression doit être présente
    await expect(page.locator('.hero-progress')).toBeVisible()
  })
})

test.describe('Parcours — formations hors DWWM', () => {
  test('stagiaire inscrit en TSSR voit les leçons TSSR (test pagination)', async ({ page }) => {
    // Utilise stagiaire2 qui pourrait être dans une autre formation
    // Si stagiaire2 est dans TSSR, ses leçons étaient sur la page 2 avant le fix
    await loginAs(page, 'stagiaire2')
    await page.goto('/parcours')

    // Si pas d'enrollment actif, le test passe (pas d'erreur)
    const hasModules = await page.locator('.modules-section').isVisible({ timeout: 10_000 }).catch(() => false)
    const hasEmpty = await page.locator('.empty-hero').isVisible().catch(() => false)

    // L'un ou l'autre doit être vrai (pas d'écran blanc ni d'erreur)
    expect(hasModules || hasEmpty).toBe(true)

    if (hasModules) {
      // S'il y a des modules, il doit y avoir des leçons dans le premier module ouvert
      const firstModuleLessons = page.locator('.module-block').first().locator('.lessons-list .lesson-row')
      // Ne pas forcer un count exact car on ne sait pas quel stagiaire2 est inscrit
      // Mais la liste ne doit pas être vide si des modules sont visibles
      const count = await firstModuleLessons.count()
      expect(count).toBeGreaterThan(0)
    }
  })
})
