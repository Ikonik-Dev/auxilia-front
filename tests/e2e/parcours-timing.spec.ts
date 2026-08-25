import { test, expect } from '@playwright/test'
import { loginAs, DEMO_CREDENTIALS } from './helpers'

/**
 * Spec de MESURE, pas d'assertion fonctionnelle.
 *
 * Deux audits successifs ont rendu des verdicts opposés sur /parcours en se
 * fondant sur une observation à l'œil nu : l'un a vu un écran vide, l'autre un
 * contenu correct. Les deux peuvent avoir raison à des instants différents.
 * Cette spec échantillonne l'état réel du DOM au fil du temps et journalise les
 * requêtes API, pour que le verdict repose sur une trace reproductible.
 *
 * Ce qu'elle établit :
 *   1. la branche de rendu finalement atteinte, par profil ;
 *   2. le temps réel de peuplement de la page ;
 *   3. l'existence — ou non — d'un instant où l'écran ne porte que son titre.
 */

/** Marqueurs de rendu, un par branche du template (src/pages/parcours/index.vue). */
const MARQUEURS = {
  titre:      'h1',
  skeleton:   '.list-skeleton',
  vide:       '.empty-hero',
  erreur:     '.dash-error',
  selecteur:  '.enrollment-selector',
  hero:       '.enrollment-hero',
  programme:  '.modules-section',
  aucunModule:'.empty-state',
  jalons:     '.milestones-section',
  indication: '.pick-hint',
  historique: '.others-section',
} as const

type Marqueur = keyof typeof MARQUEURS

/** Marqueurs qui constituent un contenu : leur absence sous le titre = écran nu. */
const MARQUEURS_CONTENU: Marqueur[] = [
  'skeleton', 'vide', 'erreur', 'selecteur', 'hero',
  'programme', 'aucunModule', 'jalons', 'indication', 'historique',
]

/** Offsets d'échantillonnage depuis la navigation vers /parcours, en ms. */
const ECHANTILLONS_MS = [300, 700, 1500, 3000, 5000, 8000, 12000, 18000, 25000]

interface Echantillon {
  tMs: number
  presents: Marqueur[]
  requetesEnVol: number
}

interface TraceRequete {
  methode: string
  url: string
  debutMs: number
  finMs: number | null
  statut: number | null
}

for (const profil of ['stagiaire3', 'stagiaire', 'stagiaire2'] as const) {
  test(`chronologie de rendu de /parcours — ${profil}`, async ({ page }) => {
    await loginAs(page, profil)

    const requetes = new Map<string, TraceRequete>()
    let t0 = 0

    page.on('request', (req) => {
      if (!req.url().includes('/api/')) return
      requetes.set(req.url() + '#' + requetes.size, {
        methode: req.method(),
        url:     new URL(req.url()).pathname + new URL(req.url()).search,
        debutMs: Date.now() - t0,
        finMs:   null,
        statut:  null,
      })
    })
    page.on('response', (res) => {
      if (!res.url().includes('/api/')) return
      // Renseigne la première trace encore ouverte pour cette URL.
      for (const trace of requetes.values()) {
        if (trace.finMs === null && res.url().endsWith(trace.url)) {
          trace.finMs  = Date.now() - t0
          trace.statut = res.status()
          break
        }
      }
    })

    t0 = Date.now()
    await page.goto('/parcours', { waitUntil: 'commit' })

    const echantillons: Echantillon[] = []
    for (const cible of ECHANTILLONS_MS) {
      const reste = cible - (Date.now() - t0)
      if (reste > 0) await page.waitForTimeout(reste)

      const presents: Marqueur[] = []
      for (const [nom, selecteur] of Object.entries(MARQUEURS) as [Marqueur, string][]) {
        if (await page.locator(selecteur).first().isVisible().catch(() => false)) {
          presents.push(nom)
        }
      }
      echantillons.push({
        tMs: Date.now() - t0,
        presents,
        requetesEnVol: [...requetes.values()].filter((r) => r.finMs === null).length,
      })
    }

    // ── Rapport ─────────────────────────────────────────────────────────────
    const lignes: string[] = []
    lignes.push(`\n═══ /parcours — ${profil} (${DEMO_CREDENTIALS[profil].email}) ═══`)
    lignes.push('\n  Requêtes /api déclenchées par la page :')
    for (const r of requetes.values()) {
      const fin = r.finMs === null ? 'EN VOL' : `${r.finMs} ms`
      lignes.push(`    ${String(r.debutMs).padStart(6)} ms → ${fin.padStart(8)}  ${r.statut ?? '—'}  ${r.methode} ${r.url}`)
    }
    lignes.push(`  Total : ${requetes.size} requête(s)`)

    lignes.push('\n  État du DOM au fil du temps :')
    for (const e of echantillons) {
      const contenu = e.presents.filter((m) => MARQUEURS_CONTENU.includes(m))
      const verdict = !e.presents.includes('titre')
        ? 'PAS ENCORE MONTÉ'
        : contenu.length === 0
          ? '⚠ ÉCRAN NU (titre seul)'
          : contenu.join(' + ')
      lignes.push(`    t=${String(e.tMs).padStart(6)} ms  [${e.requetesEnVol} en vol]  ${verdict}`)
    }
    console.log(lignes.join('\n'))

    // ── Assertions ──────────────────────────────────────────────────────────
    // 1. La page finit par atteindre un état terminal porteur de contenu.
    const dernier = echantillons[echantillons.length - 1]!
    const contenuFinal = dernier.presents.filter((m) => MARQUEURS_CONTENU.includes(m))
    expect(
      contenuFinal,
      `${profil} : aucune branche du template ne rend après ${dernier.tMs} ms`,
    ).not.toHaveLength(0)

    // 2. Aucun instant où l'utilisateur voit le titre seul, une fois la page
    //    montée. C'est le constat de la session A, mesuré plutôt que supposé.
    const nus = echantillons.filter(
      (e) => e.presents.includes('titre')
        && e.presents.filter((m) => MARQUEURS_CONTENU.includes(m)).length === 0,
    )
    expect(
      nus.map((e) => `${e.tMs} ms`),
      `${profil} : écran nu (titre sans contenu ni état de chargement) à ces instants`,
    ).toEqual([])
  })
}
