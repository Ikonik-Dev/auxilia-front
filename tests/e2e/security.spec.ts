import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

test.describe('Sécurité — LessonCompletion ownership', () => {
  test('une IRI d\'enrollment inexistante est rejetée', async ({ page }) => {
    // Contrôle de forme uniquement. Ce test ne dit RIEN de l'ownership :
    // l'API rejette l'IRI avant même de regarder à qui elle appartiendrait.
    // Le vrai contrôle d'ownership est le test suivant.
    await loginAs(page, 'stagiaire')

    const lessons = await (await page.request.get('/api/lessons?page=1', { headers: JSON_HEADERS })).json()
    expect(lessons.length).toBeGreaterThan(0)

    const postRes = await page.request.post('/api/lesson_completions', {
      headers: JSON_HEADERS,
      data: {
        lesson:             `/api/lessons/${lessons[0].id}`,
        enrollment:         '/api/enrollments/99999',
        status:             'completed',
        progressPercentage: '100',
        timeSpentMinutes:   0,
        lastAccessedAt:     new Date().toISOString(),
      },
    })

    // 400 : IRI non résolvable (réponse actuelle de l'API).
    // 404/422 seraient tout aussi acceptables. Ce qui compte : pas de création.
    expect([400, 404, 422]).toContain(postRes.status())
  })

  test('un stagiaire ne peut pas créer une completion sur l\'enrollment réel d\'un autre stagiaire', async ({ browser }) => {
    // Le vrai test d'ownership : on vise une inscription qui existe et qui
    // appartient à quelqu'un d'autre. Deux contextes = deux identités, car les
    // cookies HttpOnly sont portés par le contexte du navigateur.

    // 1. Le directeur voit toutes les inscriptions → source des IRI réelles.
    const dirCtx = await browser.newContext()
    const dirPage = await dirCtx.newPage()
    await loginAs(dirPage, 'directeur')
    const allEnrollments = await (
      await dirPage.request.get('/api/enrollments?page=1', { headers: JSON_HEADERS })
    ).json()
    await dirCtx.close()
    expect(allEnrollments.length).toBeGreaterThan(0)

    // 2. Le stagiaire : son identité et ses propres inscriptions.
    const stgCtx = await browser.newContext()
    const stgPage = await stgCtx.newPage()
    await loginAs(stgPage, 'stagiaire')
    const me = await (await stgPage.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()
    expect(me.id).toBeTruthy()

    // 3. Une inscription réelle appartenant à un AUTRE utilisateur.
    const foreign = allEnrollments.find(
      (e: { id: number; user?: { id?: number } }) => e.user?.id && e.user.id !== me.id,
    )
    expect(foreign, "aucune inscription d'un autre utilisateur dans la page 1").toBeTruthy()

    const lessons = await (
      await stgPage.request.get('/api/lessons?page=1', { headers: JSON_HEADERS })
    ).json()
    expect(lessons.length).toBeGreaterThan(0)

    const postRes = await stgPage.request.post('/api/lesson_completions', {
      headers: JSON_HEADERS,
      data: {
        lesson:             `/api/lessons/${lessons[0].id}`,
        enrollment:         `/api/enrollments/${foreign.id}`,
        status:             'completed',
        progressPercentage: '100',
        timeSpentMinutes:   0,
        lastAccessedAt:     new Date().toISOString(),
      },
    })

    // Doit être refusé. Un 201 signifierait qu'un stagiaire peut valider les
    // leçons d'un autre — fuite cross-tenant.
    expect(
      [403, 404, 422],
      `POST accepté avec le statut ${postRes.status()} — ownership non vérifié côté API`,
    ).toContain(postRes.status())

    await stgCtx.close()
  })

  test('accès non authentifié → 401 sur les endpoints protégés', async ({ page }) => {
    const res = await page.request.get('/api/enrollments', {
      headers: { Accept: 'application/json' },
    })
    expect(res.status()).toBe(401)
  })
})
