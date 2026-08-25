import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Sonde des surfaces d'ÉCRITURE cross-tenant.
 *
 * Le test de `security.spec.ts` ne couvre qu'un verbe sur une ressource et
 * accepte trois codes de refus (403/404/422) — un 422 de validation le ferait
 * passer sans qu'aucun contrôle d'ownership n'existe. Cette spec lit le statut
 * ET le corps, pour distinguer « refusé pour propriété » de « refusé pour la
 * forme ».
 *
 * ⚠ Une sonde qui réussit écrit en base de dev. Recharger ensuite :
 *   docker compose exec php php bin/console doctrine:fixtures:load --no-interaction
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

interface Resultat {
  libelle: string
  verbe: string
  url: string
  statut: number
  motif: string
  attendu: string
}

function motif(corps: string): string {
  try {
    const j = JSON.parse(corps)
    return String(j['hydra:description'] ?? j.detail ?? j.description ?? j.message ?? corps).slice(0, 160)
  } catch {
    return corps.slice(0, 160)
  }
}

function rapporter(titre: string, resultats: Resultat[]): void {
  const lignes = [`\n═══ ${titre} ═══`]
  for (const r of resultats) {
    lignes.push(`  ${r.verbe.padEnd(5)} ${r.url.padEnd(42)} → ${r.statut}`)
    lignes.push(`        ${r.libelle}`)
    lignes.push(`        attendu : ${r.attendu}`)
    lignes.push(`        motif   : ${r.motif}`)
  }
  console.log(lignes.join('\n'))
}

test.describe('Surface d\'ownership — écriture', () => {
  test('écritures cross-tenant depuis un compte stagiaire', async ({ browser }) => {
    const ctxDir = await browser.newContext()
    const pDir   = await ctxDir.newPage()
    await loginAs(pDir, 'directeur')

    const ctxStg = await browser.newContext()
    const pStg   = await ctxStg.newPage()
    await loginAs(pStg, 'stagiaire')
    const me = await (await pStg.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()

    // ── Cibles réelles appartenant à un autre utilisateur ────────────────────
    const toutes = await (
      await pDir.request.get('/api/enrollments?page=1', { headers: JSON_HEADERS })
    ).json()
    const inscriptionEtrangere = toutes.find(
      (e: { id: number; user?: { id?: number } }) => e.user?.id && e.user.id !== me.id,
    )
    const autreUtilisateurId = inscriptionEtrangere.user.id
    const mienne = toutes.find((e: { id: number; user?: { id?: number } }) => e.user?.id === me.id)
    expect(inscriptionEtrangere, 'inscription d\'autrui introuvable').toBeTruthy()
    expect(mienne, 'inscription du stagiaire introuvable').toBeTruthy()

    // Une complétion d'autrui, repérée via la vue exhaustive du directeur.
    let completionEtrangere: { id: number } | null = null
    for (let page = 1; page <= 8 && completionEtrangere === null; page++) {
      const lot = await (
        await pDir.request.get(`/api/lesson_completions?page=${page}`, { headers: JSON_HEADERS })
      ).json()
      if (!Array.isArray(lot) || lot.length === 0) break
      completionEtrangere = lot.find(
        (c: { id: number; enrollment?: string }) =>
          c.enrollment === `/api/enrollments/${inscriptionEtrangere.id}`,
      ) ?? null
    }

    const lecons = await (await pStg.request.get('/api/lessons?page=1', { headers: JSON_HEADERS })).json()
    const evaluations = await (await pStg.request.get('/api/evaluations?page=1', { headers: JSON_HEADERS })).json()

    const resultats: Resultat[] = []
    async function sonde(
      libelle: string, verbe: 'POST' | 'PUT', url: string,
      data: Record<string, unknown>, attendu: string,
    ) {
      const res = verbe === 'POST'
        ? await pStg.request.post(url, { headers: JSON_HEADERS, data })
        : await pStg.request.put(url, { headers: JSON_HEADERS, data })
      resultats.push({ libelle, verbe, url, statut: res.status(), motif: motif(await res.text()), attendu })
      return res
    }

    // ── 1. POST lesson_completion sur l'inscription d'autrui ────────────────
    await sonde(
      'création d\'une complétion sur l\'inscription d\'un autre stagiaire',
      'POST', '/api/lesson_completions',
      {
        lesson:             `/api/lessons/${lecons[0].id}`,
        enrollment:         `/api/enrollments/${inscriptionEtrangere.id}`,
        status:             'completed',
        progressPercentage: '100',
        timeSpentMinutes:   0,
        lastAccessedAt:     new Date().toISOString(),
      },
      '403 — ownership refusé par LessonCompletionStateProcessor',
    )

    // ── 2. PUT sur la complétion d'un autre ─────────────────────────────────
    if (completionEtrangere) {
      await sonde(
        'modification de la complétion d\'un autre stagiaire',
        'PUT', `/api/lesson_completions/${completionEtrangere.id}`,
        {
          lesson:             `/api/lessons/${lecons[0].id}`,
          enrollment:         `/api/enrollments/${inscriptionEtrangere.id}`,
          status:             'not_started',
          progressPercentage: '0',
          timeSpentMinutes:   0,
          lastAccessedAt:     new Date().toISOString(),
        },
        '403 — refus attendu',
      )
    }

    // NB : `POST /api/evaluation_submissions` est volontairement absent de cette
    // liste — il est FAILLIBLE, et sa sonde écrirait en base à chaque exécution.
    // Voir le test.fixme « DETTE BACK-OWN-1 » plus bas.

    // ── 3. POST attendance (opération réservée au staff) ────────────────────
    await sonde(
      'création d\'un pointage d\'assiduité',
      'POST', '/api/attendances',
      {
        user:     `/api/users/${autreUtilisateurId}`,
        status:   'present',
        markedAt: new Date().toISOString(),
      },
      '403 — Post réservé à ROLE_ADMIN/ROLE_FORMATEUR',
    )

    // ── 4. POST / PUT enrollment (opérations réservées au staff) ────────────
    await sonde(
      'création d\'une inscription',
      'POST', '/api/enrollments',
      {
        user:              `/api/users/${me.id}`,
        session:           inscriptionEtrangere.session?.['@id'] ?? `/api/sessions/${inscriptionEtrangere.session?.id}`,
        status:            'active',
        enrollmentDate:    new Date().toISOString(),
      },
      '403 — Post réservé à ROLE_ADMIN/ROLE_FORMATEUR',
    )
    await sonde(
      'modification de l\'inscription d\'un autre stagiaire',
      'PUT', `/api/enrollments/${inscriptionEtrangere.id}`,
      { status: 'abandoned' },
      '403 — Put réservé à ROLE_ADMIN/ROLE_FORMATEUR',
    )

    rapporter('Écritures cross-tenant tentées par stagiaire@auxilium.test', resultats)

    // Aucune sonde ne doit aboutir à une création/modification.
    const abouties = resultats.filter((r) => r.statut >= 200 && r.statut < 300)
    expect(
      abouties.map((r) => `${r.verbe} ${r.url} → ${r.statut}`),
      'écritures cross-tenant ACCEPTÉES par l\'API',
    ).toEqual([])

    await ctxDir.close()
    await ctxStg.close()
  })

  /**
   * DETTE BACK-OWN-1 — `POST /api/evaluation_submissions` accepte une écriture
   * entièrement cross-tenant. PROUVÉ le 19 août 2026 : depuis le compte
   * stagiaire@auxilium.test (id 157), deux POST ont renvoyé **201** et créé en
   * base les lignes `evaluation_submission` #126 et #127 avec `user_id = 165`
   * (stagiaire2), l'une sur l'inscription #96 qui appartient à 165.
   *
   * Cause : `EvaluationSubmission::$user` est dans le groupe `submission:write`
   * (auxilia-api/src/Entity/EvaluationSubmission.php:96-99), l'opération Post est
   * ouverte à `is_granted('ROLE_USER')` (ligne 33), et
   * EvaluationSubmissionStateProcessor ne force ni ne vérifie ce champ
   * (auxilia-api/src/State/Processor/EvaluationSubmissionStateProcessor.php:32-62).
   *
   * Impact aggravant : la contrainte d'unicité (evaluation, user, attempt_number)
   * permet aussi de **préempter** la tentative n° N d'un autre stagiaire.
   *
   * Correctif attendu (backend, hors périmètre de cette session) : forcer
   * `$data->setUser($this->security->getUser())` sur Post, et refuser toute
   * `enrollment` dont l'utilisateur n'est pas l'utilisateur courant.
   *
   * Réactiver ce test (`test.fixme` → `test`) une fois le correctif appliqué.
   * Il écrit en base : recharger les fixtures après exécution.
   */
  test('DETTE BACK-OWN-1 — le champ `user` d\'une soumission est forgeable', async ({ browser }) => {
    const ctxDir = await browser.newContext()
    const pDir   = await ctxDir.newPage()
    await loginAs(pDir, 'directeur')
    const ctxStg = await browser.newContext()
    const pStg   = await ctxStg.newPage()
    await loginAs(pStg, 'stagiaire')
    const me = await (await pStg.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()

    const toutes = await (
      await pDir.request.get('/api/enrollments?page=1', { headers: JSON_HEADERS })
    ).json()
    const etrangere = toutes.find(
      (e: { id: number; user?: { id?: number } }) => e.user?.id && e.user.id !== me.id,
    )
    const evaluations = await (
      await pStg.request.get('/api/evaluations?page=1', { headers: JSON_HEADERS })
    ).json()

    const res = await pStg.request.post('/api/evaluation_submissions', {
      headers: JSON_HEADERS,
      data: {
        evaluation:    `/api/evaluations/${evaluations[0].id}`,
        enrollment:    `/api/enrollments/${etrangere.id}`,
        user:          `/api/users/${etrangere.user.id}`,
        status:        'in_progress',
        attemptNumber: 97,
        maxScore:      '100.00',
        percentage:    '0.00',
      },
    })
    expect(res.status(), `corps : ${await res.text()}`).toBe(403)

    await ctxDir.close()
    await ctxStg.close()
  })

  /**
   * DETTE BACK-OWN-2 — une complétion créée par l'application est illisible et
   * immodifiable par son propre auteur. PROUVÉ le 19 août 2026 :
   *   POST /api/lesson_completions            → 201, champ `user` renvoyé `null`
   *   GET  /api/lesson_completions/1944       → 403
   *   PUT  /api/lesson_completions/1944       → 403  « Access Denied. »
   *
   * Cause : deux notions d'ownership coexistent sur la même entité.
   *   - `LessonCompletion::$user` (nullable) porte la sécurité item
   *     `object.getUser() == user` (auxilia-api/src/Entity/LessonCompletion.php:29,31) ;
   *   - `LessonCompletion.enrollment.user` porte le contrôle du processor
   *     (auxilia-api/src/State/Processor/LessonCompletionStateProcessor.php:35)
   *     et le filtrage de collection
   *     (auxilia-api/src/Doctrine/Extension/CurrentUserQueryExtension.php:50-53).
   * Le processor n'appelle jamais `setUser()` et le front n'envoie pas ce champ :
   * 909 des 967 complétions en base ont `user_id IS NULL`.
   *
   * Conséquence fonctionnelle front : dans useParcours.updateLessonStatus(), la
   * branche PUT (`lesson.completionId` renseigné) échoue en 403 pour toute
   * complétion créée par l'application — un stagiaire ne peut pas revenir sur le
   * statut d'une leçon qu'il vient de marquer. Les fixtures masquent le défaut :
   * elles renseignent `user_id` pour les 58 complétions de stagiaire@.
   *
   * Correctif attendu (backend, hors périmètre) : renseigner
   * `$data->setUser($data->getEnrollment()?->getUser())` dans le processor, ou
   * aligner la sécurité item sur `object.getEnrollment().getUser()`.
   */
  test('DETTE BACK-OWN-2 — un stagiaire peut relire et modifier la complétion qu\'il vient de créer', async ({ page }) => {
    await loginAs(page, 'stagiaire')
    const me = await (await page.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()

    const inscriptions = await (
      await page.request.get('/api/enrollments?page=1', { headers: JSON_HEADERS })
    ).json()
    const mienne = inscriptions.find((e: { id: number; status: string }) => e.status === 'active')
      ?? inscriptions[0]
    const lecons = await (await page.request.get('/api/lessons?page=1', { headers: JSON_HEADERS })).json()

    const creation = await page.request.post('/api/lesson_completions', {
      headers: JSON_HEADERS,
      data: {
        lesson:             `/api/lessons/${lecons[lecons.length - 1].id}`,
        enrollment:         `/api/enrollments/${mienne.id}`,
        status:             'in_progress',
        progressPercentage: '50',
        timeSpentMinutes:   0,
        lastAccessedAt:     new Date().toISOString(),
      },
    })
    const cree = await creation.json().catch(() => null)
    console.log('\n═══ Cycle de vie d\'une complétion créée par l\'application ═══')
    console.log(`  POST /api/lesson_completions → ${creation.status()}`)
    console.log(`  champ user renvoyé : ${JSON.stringify(cree?.user ?? null)}  (utilisateur courant : /api/users/${me.id})`)
    expect(creation.status(), 'le stagiaire doit pouvoir créer une complétion sur SA propre inscription').toBe(201)

    const relecture = await page.request.get(`/api/lesson_completions/${cree.id}`, { headers: JSON_HEADERS })
    console.log(`  GET  /api/lesson_completions/${cree.id} → ${relecture.status()}`)

    const modification = await page.request.put(`/api/lesson_completions/${cree.id}`, {
      headers: JSON_HEADERS,
      data: {
        lesson:             `/api/lessons/${lecons[lecons.length - 1].id}`,
        enrollment:         `/api/enrollments/${mienne.id}`,
        status:             'completed',
        progressPercentage: '100',
        timeSpentMinutes:   5,
        lastAccessedAt:     new Date().toISOString(),
      },
    })
    console.log(`  PUT  /api/lesson_completions/${cree.id} → ${modification.status()}`)
    console.log(`        motif : ${motif(await modification.text())}`)

    expect(relecture.status(), 'le propriétaire doit pouvoir relire sa propre complétion').toBe(200)
    expect(modification.status(), 'le propriétaire doit pouvoir modifier sa propre complétion').toBe(200)
  })
})
