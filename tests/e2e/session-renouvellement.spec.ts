import { test, expect, request } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Lot 1.1b (F1) — la session survit à l'expiration du jeton d'accès, et le logout révoque.
 *
 * Compte dédié (`stagiaire3`) : aucun autre spec ne s'en sert, donc ni la révocation du
 * deuxième test ni la suppression de cookie du premier ne perturbent le reste de la suite.
 */
test.describe('Renouvellement de session', () => {
  test('jeton d’accès expiré en cours de navigation : un refresh, la page se charge, pas de /login', async ({
    page,
    context,
  }) => {
    await loginAs(page, 'stagiaire3', { forceLogin: true })

    // Expiration simulée : le cookie d'accès disparaît, le jeton de rafraîchissement reste.
    await context.clearCookies({ name: 'BEARER' })

    const refreshes: number[] = []
    const documents: number[] = []
    page.on('response', (r) => {
      const { pathname } = new URL(r.url())
      if (pathname === '/api/auth/refresh' && r.request().method() === 'POST') refreshes.push(r.status())
      if (pathname === '/api/documents') documents.push(r.status())
    })

    // Navigation DANS l'application (pas de rechargement) : c'est le cas que le garde de
    // routeur ne rattrapait pas.
    await page.getByRole('link', { name: 'Mes Documents' }).click()
    await expect(page).toHaveURL(/\/documents/)
    await expect.poll(() => documents.at(-1)).toBe(200)

    expect(refreshes).toEqual([204])
    expect(documents[0]).toBe(401) // la requête d'origine a bien échoué avant d'être rejouée
    expect((await context.cookies()).some((c) => c.name === 'BEARER')).toBe(true)
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('logout : le jeton de rafraîchissement d’avant la déconnexion est refusé (401)', async ({
    page,
    context,
  }) => {
    await loginAs(page, 'stagiaire3', { forceLogin: true })
    const refreshToken = (await context.cookies()).find((c) => /refresh/i.test(c.name))
    expect(refreshToken, 'cookie de rafraîchissement posé à la connexion').toBeTruthy()

    await page.getByRole('button', { name: /déconnexion/i }).click()
    await page.waitForURL(/\/login/, { timeout: 10_000 })

    // Client HTTP isolé : il ne porte que le jeton d'avant la déconnexion.
    const isole = await request.newContext({ baseURL: 'http://localhost:5173' })
    const rejeu = await isole.post('/api/auth/refresh', {
      headers: { Cookie: `${refreshToken!.name}=${refreshToken!.value}` },
    })
    expect(rejeu.status()).toBe(401)
    await isole.dispose()
  })
})
