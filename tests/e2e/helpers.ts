import type { Cookie, Page } from '@playwright/test'

export const DEMO_CREDENTIALS = {
  stagiaire:   { email: 'stagiaire@auxilium.test',   password: 'Test1234!' },
  formateur:   { email: 'formateur@auxilium.test',   password: 'Test1234!' },
  directeur:   { email: 'directeur@auxilium.test',   password: 'Test1234!' },
  stagiaire2:  { email: 'stagiaire2@auxilium.test',  password: 'Test1234!' },
  // Profil sans aucune inscription active (1 seule inscription, `completed`) :
  // c'est le cas qui a opposé les audits sur l'écran vide de /parcours.
  stagiaire3:  { email: 'stagiaire3@auxilium.test',  password: 'Test1234!' },
  // Seul compte ROLE_ADMIN du jeu de démonstration : le seul pour lequel
  // /utilisateurs s'affiche au lieu de l'écran « Accès réservé ».
  superviseur: { email: 'superviseur@auxilium.test', password: 'Test1234!' },
}

export type Role = keyof typeof DEMO_CREDENTIALS

/**
 * Sessions déjà obtenues, par rôle, pour ce worker Playwright.
 *
 * Le firewall applique un `login_throttling` de 5 tentatives par minute et par
 * compte (auxilia-api/config/packages/security.yaml:24-26). Une suite où chaque
 * test se reconnecte dépasse ce quota et échoue en cascade — les échecs
 * ressemblent alors à des bugs applicatifs alors qu'ils sont provoqués par les
 * tests eux-mêmes. On ne se connecte donc qu'une fois par rôle et par worker,
 * puis on rejoue les cookies HttpOnly dans les contextes suivants.
 */
const sessions = new Map<Role, Cookie[]>()

async function connexionReelle(page: Page, role: Role): Promise<void> {
  const { email, password } = DEMO_CREDENTIALS[role]
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  // PrimeVue v4 <Password> ne propage pas l'attribut autocomplete sur l'input interne :
  // on cible le nom accessible, qui vient du <label for="password"> + inputId="password".
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: /se connecter/i }).click()
  // Attend la redirection vers le dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
  sessions.set(role, await page.context().cookies())
}

/**
 * @param options.forceLogin  passe par le formulaire même si une session est en
 *   cache — à utiliser par les tests qui vérifient le mécanisme de connexion
 *   lui-même, pas seulement son résultat.
 */
export async function loginAs(
  page: Page,
  role: Role,
  options: { forceLogin?: boolean } = {},
): Promise<void> {
  const cache = sessions.get(role)

  if (cache && !options.forceLogin) {
    await page.context().addCookies(cache)
    await page.goto('/dashboard')
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
      return
    } catch {
      // Session expirée ou rejetée : on repasse par le formulaire.
      sessions.delete(role)
    }
  }

  await connexionReelle(page, role)
}
