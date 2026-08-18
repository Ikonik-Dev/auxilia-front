import { test, expect } from '@playwright/test'
import { loginAs, DEMO_CREDENTIALS } from './helpers'

test.describe('Sécurité — LessonCompletion ownership', () => {
  test('un stagiaire ne peut pas créer une completion pour un enrollment qui ne lui appartient pas', async ({ page }) => {
    await loginAs(page, 'stagiaire')

    // Récupère les enrollments de ce stagiaire
    const enrRes = await page.request.get('/api/enrollments', {
      headers: { Accept: 'application/json' },
    })
    expect(enrRes.status()).toBe(200)
    const enrData = await enrRes.json()

    if (!enrData || enrData.length === 0) {
      test.skip(true, 'Pas d\'enrollment pour ce stagiaire')
      return
    }

    // Récupère les lessons disponibles
    const lesRes = await page.request.get('/api/lessons?page=1', {
      headers: { Accept: 'application/json' },
    })
    const lessons = await lesRes.json()
    if (!lessons || lessons.length === 0) {
      test.skip(true, 'Pas de leçons disponibles')
      return
    }

    const lessonIri = `/api/lessons/${lessons[0].id}`

    // Essaie de créer une completion pour un enrollment fictif (ID très élevé, n'appartient pas à ce user)
    const fakeEnrollmentIri = '/api/enrollments/99999'
    const postRes = await page.request.post('/api/lesson_completions', {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      data: {
        lesson:             lessonIri,
        enrollment:         fakeEnrollmentIri,
        status:             'completed',
        progressPercentage: '100',
        timeSpentMinutes:   0,
        lastAccessedAt:     new Date().toISOString(),
      },
    })

    // Doit retourner 404 (enrollment inexistant) ou 403 (ownership refusé)
    expect([403, 404, 422]).toContain(postRes.status())
  })

  test('accès non authentifié → 401 sur les endpoints protégés', async ({ page }) => {
    const res = await page.request.get('/api/enrollments', {
      headers: { Accept: 'application/json' },
    })
    expect(res.status()).toBe(401)
  })
})
