import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

/**
 * Sonde de surface d'ownership.
 *
 * Le test de `security.spec.ts` ne couvre qu'un verbe sur une ressource
 * (POST /api/lesson_completions). Cette spec élargit : elle interroge chaque
 * surface où un stagiaire pourrait lire ou écrire la donnée d'un autre, et
 * journalise le statut ET le motif renvoyés — un 422 de validation n'est pas
 * une preuve d'ownership.
 *
 * Elle RAPPORTE avant d'asserter : les tableaux imprimés sont la pièce
 * justificative du contre-audit.
 */

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

/** Collections lisibles par un ROLE_USER, avec le champ qui trahit le propriétaire. */
const COLLECTIONS = [
  { chemin: 'answers',                 proprietaire: null },
  { chemin: 'questions',               proprietaire: null },
  { chemin: 'evaluations',             proprietaire: null },
  { chemin: 'messages',                proprietaire: 'sender/recipient' },
  { chemin: 'documents',               proprietaire: null },
  { chemin: 'media',                   proprietaire: null },
  { chemin: 'schedules',               proprietaire: null },
  { chemin: 'sessions',                proprietaire: null },
  { chemin: 'modules',                 proprietaire: null },
  { chemin: 'lessons',                 proprietaire: null },
  { chemin: 'enrollments',             proprietaire: 'user' },
  { chemin: 'lesson_completions',      proprietaire: 'enrollment' },
  { chemin: 'parcours',                proprietaire: 'enrollment' },
  { chemin: 'milestones',              proprietaire: 'parcours' },
  { chemin: 'evaluation_submissions',  proprietaire: 'user' },
  { chemin: 'attendances',             proprietaire: 'user' },
  { chemin: 'responses',               proprietaire: 'submission' },
  { chemin: 'document_downloads',      proprietaire: 'downloadedBy' },
  { chemin: 'media_views',             proprietaire: 'user' },
  { chemin: 'formation_feedback',      proprietaire: 'givenBy' },
  { chemin: 'notifications',           proprietaire: 'user' },
  { chemin: 'users',                   proprietaire: 'self' },
] as const

interface Mesure {
  chemin: string
  statutStagiaire: number
  nbStagiaire: number | string
  statutDirecteur: number
  nbDirecteur: number | string
}

function tailleReponse(corps: unknown): number | string {
  if (Array.isArray(corps)) return corps.length
  if (corps && typeof corps === 'object' && 'hydra:totalItems' in corps) {
    return `${(corps as Record<string, unknown>)['hydra:totalItems']} (hydra)`
  }
  return '—'
}

test.describe('Surface d\'ownership — lecture', () => {
  test('collections : ce qu\'un stagiaire voit vs ce que voit le directeur', async ({ browser }) => {
    const ctxStg = await browser.newContext()
    const pStg   = await ctxStg.newPage()
    await loginAs(pStg, 'stagiaire')

    const ctxDir = await browser.newContext()
    const pDir   = await ctxDir.newPage()
    await loginAs(pDir, 'directeur')

    // 22 ressources × 2 rôles en séquentiel dépassait le timeout du test sur
    // Docker/Windows (~1,5 s par aller-retour). On interroge en parallèle.
    const mesures: Mesure[] = await Promise.all(
      COLLECTIONS.map(async ({ chemin }): Promise<Mesure> => {
        const [rStg, rDir] = await Promise.all([
          pStg.request.get(`/api/${chemin}?page=1`, { headers: JSON_HEADERS }),
          pDir.request.get(`/api/${chemin}?page=1`, { headers: JSON_HEADERS }),
        ])
        const cStg = await rStg.json().catch(() => null)
        const cDir = await rDir.json().catch(() => null)
        return {
          chemin,
          statutStagiaire: rStg.status(),
          nbStagiaire:     rStg.ok() ? tailleReponse(cStg) : '—',
          statutDirecteur: rDir.status(),
          nbDirecteur:     rDir.ok() ? tailleReponse(cDir) : '—',
        }
      }),
    )

    const lignes = ['\n═══ Collections : stagiaire vs directeur (page 1) ═══',
      '  ressource                    stagiaire      directeur      cloisonné ?']
    for (const m of mesures) {
      const cloisonne = m.statutStagiaire !== 200
        ? 'refusé au stagiaire'
        : m.nbStagiaire === m.nbDirecteur
          ? '⚠ MÊME VOLUME'
          : 'oui (volumes différents)'
      lignes.push(
        `  ${m.chemin.padEnd(26)} ${String(m.statutStagiaire).padEnd(4)} ${String(m.nbStagiaire).padEnd(9)} ` +
        `${String(m.statutDirecteur).padEnd(4)} ${String(m.nbDirecteur).padEnd(9)} ${cloisonne}`,
      )
    }
    console.log(lignes.join('\n'))

    // Sonde ciblée : le corrigé des QCM est-il lisible par un stagiaire ?
    const rAnswers = await pStg.request.get('/api/answers?page=1', { headers: JSON_HEADERS })
    if (rAnswers.ok()) {
      const answers = await rAnswers.json()
      const premier = Array.isArray(answers) && answers.length > 0 ? answers[0] : null
      console.log('\n═══ GET /api/answers en tant que stagiaire ═══')
      console.log(`  statut ${rAnswers.status()}, ${Array.isArray(answers) ? answers.length : '?'} enregistrement(s)`)
      if (premier === null) {
        // Les fixtures ne créent aucun Answer : la collection est vide et
        // l'exposition ne peut pas être exercée ici. Elle reste structurelle —
        // `isCorrect` est dans le groupe `answer:read`, qui est le
        // normalizationContext de l'opération (Answer.php:21,45-46), et
        // GetCollection est ouvert à `is_granted('ROLE_USER')` (ligne 24).
        console.log('  collection vide — exposition non exerçable avec ces fixtures')
      } else {
        console.log(`  premier enregistrement : ${JSON.stringify(premier)}`)
        console.log(`  champ isCorrect exposé : ${'isCorrect' in premier ? '⚠ OUI' : 'non'}`)
      }
    }

    // Sonde ciblée : messagerie d'autrui.
    const rMsg = await pStg.request.get('/api/messages?page=1', { headers: JSON_HEADERS })
    if (rMsg.ok()) {
      const msgs = await rMsg.json()
      const me = await (await pStg.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()
      const etrangers = Array.isArray(msgs)
        ? msgs.filter((m: { sender?: { id?: number }; recipient?: { id?: number } }) =>
            m.sender?.id !== me.id && m.recipient?.id !== me.id)
        : []
      console.log('\n═══ GET /api/messages en tant que stagiaire ═══')
      console.log(`  statut ${rMsg.status()}, ${Array.isArray(msgs) ? msgs.length : '?'} message(s)`)
      console.log(`  messages où le stagiaire n'est ni expéditeur ni destinataire : ${etrangers.length}`)
      if (etrangers.length > 0) {
        console.log(`  exemple : ${JSON.stringify(etrangers[0]).slice(0, 400)}`)
      }
    }

    // Sonde ciblée : « même volume » peut n'être qu'un plafond de pagination
    // atteint des deux côtés. On vérifie ligne à ligne à qui appartient la donnée.
    const me = await (await pStg.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()
    const monIri = `/api/users/${me.id}`
    const rLc = await pStg.request.get('/api/lesson_completions?page=1', { headers: JSON_HEADERS })
    const lc = await rLc.json()
    if (Array.isArray(lc)) {
      const etrangeres = lc.filter((c: { user?: string }) => c.user !== monIri)
      console.log('\n═══ GET /api/lesson_completions en tant que stagiaire ═══')
      console.log(`  ${lc.length} enregistrement(s) ; appartenant à un autre : ${etrangeres.length}`)
      console.log(`  → ${etrangeres.length === 0 ? 'cloisonné (le volume identique est un plafond de pagination)' : '⚠ FUITE'}`)
    }

    // Sonde ciblée : visibilité des documents.
    const rDoc = await pStg.request.get('/api/documents?page=1', { headers: JSON_HEADERS })
    const docs = await rDoc.json()
    if (Array.isArray(docs)) {
      const parVisibilite = docs.reduce((acc: Record<string, number>, d: { visibility?: string }) => {
        const v = d.visibility ?? 'inconnue'
        acc[v] = (acc[v] ?? 0) + 1
        return acc
      }, {})
      console.log('\n═══ GET /api/documents en tant que stagiaire ═══')
      console.log(`  ${docs.length} document(s), répartition par visibilité : ${JSON.stringify(parVisibilite)}`)
    }

    await ctxStg.close()
    await ctxDir.close()
  })

  test('items : accès direct aux enregistrements d\'un autre utilisateur', async ({ browser }) => {
    const ctxDir = await browser.newContext()
    const pDir   = await ctxDir.newPage()
    await loginAs(pDir, 'directeur')

    const ctxStg = await browser.newContext()
    const pStg   = await ctxStg.newPage()
    await loginAs(pStg, 'stagiaire')
    const me = await (await pStg.request.get('/api/auth/me', { headers: JSON_HEADERS })).json()

    // Le directeur voit tout : il sert de source d'IRI réelles appartenant à autrui.
    const toutesInscriptions = await (
      await pDir.request.get('/api/enrollments?page=1', { headers: JSON_HEADERS })
    ).json()
    const inscriptionEtrangere = toutesInscriptions.find(
      (e: { id: number; user?: { id?: number } }) => e.user?.id && e.user.id !== me.id,
    )
    expect(inscriptionEtrangere, 'aucune inscription d\'autrui en page 1').toBeTruthy()

    // ⚠ Sur ces ressources, `user` est sérialisé en IRI (chaîne), pas en objet
    // embarqué : comparer `.user.id` produit un faux positif systématique.
    const monIri = `/api/users/${me.id}`

    // Le stagiaire ne voit que ses propres complétions (extension Doctrine) ;
    // pour en trouver une d'autrui il faut passer par la vue du directeur, et
    // parcourir plusieurs pages car la page 1 peut être saturée par les siennes.
    let completionEtrangere: { id: number; user?: string } | null = null
    for (let page = 1; page <= 5 && completionEtrangere === null; page++) {
      const lot = await (
        await pDir.request.get(`/api/lesson_completions?page=${page}`, { headers: JSON_HEADERS })
      ).json()
      if (!Array.isArray(lot) || lot.length === 0) break
      completionEtrangere = lot.find(
        (c: { id: number; user?: string }) => typeof c.user === 'string' && c.user !== monIri,
      ) ?? null
    }

    const soumissions = await (
      await pDir.request.get('/api/evaluation_submissions?page=1', { headers: JSON_HEADERS })
    ).json()
    const soumissionEtrangere = Array.isArray(soumissions)
      ? soumissions.find((s: { id: number; user?: { id?: number } | string }) =>
          typeof s.user === 'object' ? s.user?.id !== me.id : s.user !== monIri)
      : null

    const cibles: { libelle: string; url: string }[] = [
      { libelle: 'enrollment d\'autrui',  url: `/api/enrollments/${inscriptionEtrangere.id}` },
    ]
    if (completionEtrangere) {
      cibles.push({ libelle: 'lesson_completion d\'autrui', url: `/api/lesson_completions/${completionEtrangere.id}` })
    }
    if (soumissionEtrangere) {
      cibles.push({ libelle: 'evaluation_submission d\'autrui', url: `/api/evaluation_submissions/${soumissionEtrangere.id}` })
    }

    const lignes = ['\n═══ GET item d\'autrui, en tant que stagiaire ═══']
    for (const c of cibles) {
      const r = await pStg.request.get(c.url, { headers: JSON_HEADERS })
      const corps = await r.text()
      lignes.push(`  ${c.libelle.padEnd(34)} ${c.url.padEnd(38)} → ${r.status()}`)
      if (r.ok()) lignes.push(`     ⚠ FUITE — corps : ${corps.slice(0, 300)}`)
    }
    console.log(lignes.join('\n'))

    await ctxDir.close()
    await ctxStg.close()
  })
})
