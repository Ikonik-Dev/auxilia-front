import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Édition d'un utilisateur depuis l'écran — la chaîne complète qui était rompue.
 *
 * Jusqu'au 25 août 2026, `PUT /api/users/{id}` renvoyait 422 pour tous les rôles, y
 * compris `superviseur@`, le seul compte qui ouvre cette page : conserver son propre
 * email heurtait la contrainte d'unicité, et l'absence de mot de passe heurtait
 * `PasswordStrength`. Aucun test ne couvrait le parcours réel, seulement des PUT
 * synthétiques qui changeaient l'email à chaque exécution.
 */
test.describe('/utilisateurs — édition', () => {
  test('renomme un compte sans toucher à son email ni à son mot de passe', async ({ page }) => {
    await loginAs(page, 'superviseur')
    await page.goto('/utilisateurs')

    await expect(page.getByRole('heading', { name: 'Utilisateurs', level: 1 })).toBeVisible()

    // On édite une ligne identifiable et stable du jeu de démonstration.
    const ligne = page.getByRole('row').filter({ hasText: 'stagiaire@auxilium.test' })
    await expect(ligne).toBeVisible()
    await ligne.getByRole('button', { name: "Modifier l'utilisateur" }).click()

    const dialogue = page.getByRole('dialog')
    await expect(dialogue).toBeVisible()

    // L'email pré-rempli est renvoyé tel quel — c'est précisément ce qui produisait le 422.
    const emailAvant = await dialogue.locator('#uf-email').inputValue()
    expect(emailAvant).toBe('stagiaire@auxilium.test')

    const prenomInitial = await dialogue.locator('#uf-firstname').inputValue()
    const nouveauPrenom = `Lea-${Date.now().toString().slice(-6)}`
    await dialogue.locator('#uf-firstname').fill(nouveauPrenom)
    // Le champ mot de passe reste VIDE : « laisser vide pour conserver ».
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByText('Utilisateur modifié')).toBeVisible({ timeout: 15_000 })
    await expect(dialogue).toBeHidden()

    // Le tableau reflète la modification, et l'email n'a pas bougé.
    const ligneApres = page.getByRole('row').filter({ hasText: 'stagiaire@auxilium.test' })
    await expect(ligneApres).toContainText(nouveauPrenom)

    // Le jeu de démonstration est partagé : on remet le prénom d'origine.
    await ligneApres.getByRole('button', { name: "Modifier l'utilisateur" }).click()
    await dialogue.locator('#uf-firstname').fill(prenomInitial)
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(dialogue).toBeHidden({ timeout: 15_000 })
  })

  test('affiche le motif réel quand l\'email est déjà pris', async ({ page }) => {
    await loginAs(page, 'superviseur')
    await page.goto('/utilisateurs')

    const ligne = page.getByRole('row').filter({ hasText: 'stagiaire2@auxilium.test' })
    await expect(ligne).toBeVisible()
    await ligne.getByRole('button', { name: "Modifier l'utilisateur" }).click()

    const dialogue = page.getByRole('dialog')
    await dialogue.locator('#uf-email').fill('stagiaire@auxilium.test')
    await dialogue.getByRole('button', { name: 'Enregistrer' }).click()

    // Avant le 25 août 2026, le catch de la page écrasait tout code d'erreur par un
    // message générique : un email déjà pris et un refus de droits étaient indiscernables.
    await expect(dialogue.getByRole('alert')).toContainText(/déjà utilisée/i, { timeout: 15_000 })
  })
})
