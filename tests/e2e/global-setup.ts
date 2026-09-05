import { chromium } from '@playwright/test'

/**
 * Garde d'isolation + préchauffage — s'exécute avant tout test.
 *
 * ─── 1. GARDE ───────────────────────────────────────────────────────────────────
 *
 * POURQUOI
 * Les 7 spec écrivent (5 d'entre elles) dans la base servie par l'API. Jusqu'au
 * 5 septembre 2026, c'était toujours la base de DÉMONSTRATION, dont les données sont
 * l'unique exemplaire (`Auxilia/_backup/*.sql`). L'isolation de `bin/phpunit` par
 * `dbname_suffix` ne couvre PAS ce cas : ce réglage vit dans le bloc `when@test` de
 * `config/packages/doctrine.yaml` et ne s'applique qu'en `APP_ENV=test`, alors que les
 * conteneurs `nginx`/`php` tournent en `APP_ENV=dev`.
 *
 * La procédure retenue est de basculer la pile HTTP le temps de la suite (voir
 * `auxilia-api/CLAUDE.md` §8). Elle repose donc sur un geste humain — et un geste oublié
 * est une pollution silencieuse. Ce garde transforme l'oubli en échec immédiat et lisible.
 *
 * CE QUE LE GARDE PROUVE, ET CE QU'IL NE PROUVE PAS
 * `/api/auth/debug` répond 404 dès que `kernel.environment !== 'dev'`
 * (`AuthController.php:39-41`). Mesuré le 5 septembre 2026 : 200 en `dev`, 404 en `test`.
 *
 *   404 prouve « la pile n'est PAS en dev ». Il ne prouve PAS « la pile est en test ».
 *
 * ⚠ TROU CONNU, ASSUMÉ — `APP_ENV=prod docker compose up -d php nginx` donne aussi 404, or
 * `when@prod` de `doctrine.yaml` n'ajoute que des caches : **aucun `dbname_suffix`**. Une pile
 * en `prod` franchirait donc ce garde et la suite écrirait dans `auxilia_lms`. Le passage de
 * `compose.override.yaml:24` et `:36` à `${APP_ENV:-dev}` — qui reste la bonne décision — a
 * élargi cet angle mort : n'importe quelle valeur traverse désormais.
 * **Pourquoi on ne le bouche pas ici :** il n'existe aujourd'hui aucun signal HTTP propre
 * prouvant « c'est bien test ». Fabriquer un discriminant positif donnerait un garde plus
 * fragile que la limite qu'il masque, et un faux confort. Dette 🟡 dans `../ROADMAP.md`.
 *
 * ⚠ SECOND COUPLAGE — si `/api/auth/debug` est un jour supprimé, il répondra 404 partout et ce
 * garde laissera tout passer, en silence. **Supprimer cet endpoint impose de réécrire ce
 * fichier dans le même lot.** Toute réponse autre que 404 est refusée : le garde échoue à la
 * fermeture, jamais à l'ouverture.
 *
 * Le contrôle passe par `baseURL` (le serveur Vite), pas directement par :8080 : il vérifie
 * ainsi la chaîne complète, et signale au passage un `npm run dev` non démarré.
 *
 * ─── 2. PRÉCHAUFFAGE ────────────────────────────────────────────────────────────
 *
 * Première exécution de la suite, 5 septembre 2026 : les 3 premiers tests (`auth.spec.ts`)
 * échouaient sur une session neuve, le test 1 mettant 26,5 s contre un `waitForURL` de 15 s
 * (`helpers.ts:39`) ; rejoués Vite chaud, 3/3 verts avec le test 1 à 15,8 s. La cause est la
 * compilation à la demande de Vite, pas l'application.
 *
 * Relever le timeout aurait masqué un coût de premier chargement réel, qui serait revenu sur
 * une machine plus lente ou en CI et aurait été rediagnostiqué de zéro. On paie donc ce coût
 * ici, une fois, hors de toute assertion : un navigateur charge les routes que les spec
 * traversent en premier, ce qui force Vite à transformer les modules correspondants.
 */
const BASE_URL = 'http://localhost:5173'

const REMEDE = [
  '  Basculez la pile API en `APP_ENV=test` le temps de la suite, depuis `auxilia-api/` :',
  '',
  '    APP_ENV=test docker compose up -d php nginx',
  '    npm run test:e2e                  # depuis auxilia-front/',
  '    docker compose up -d php nginx    # retour en dev, NE PAS OUBLIER',
  '',
  '  Prérequis, une fois : la base de test doit exister et être peuplée —',
  '    docker compose exec php php bin/console doctrine:migrations:migrate --env=test --no-interaction',
  '    docker compose exec php php bin/console doctrine:fixtures:load   --env=test --no-interaction',
].join('\n')

function refuser(raison: string, remede: string): never {
  throw new Error(
    ['', '', `  SUITE E2E REFUSÉE — ${raison}`, '', remede, '', '  Détail : tests/e2e/global-setup.ts', ''].join('\n'),
  )
}

async function verifierIsolation(): Promise<void> {
  let reponse: Response
  try {
    reponse = await fetch(`${BASE_URL}/api/auth/debug`, { redirect: 'manual' })
  } catch {
    refuser(
      `l'API n'est pas joignable via ${BASE_URL}.`,
      [
        '  Démarrez le serveur Vite (`npm run dev`) et la pile Docker du backend.',
        '  `playwright.config.ts` ne configure volontairement pas `webServer`.',
      ].join('\n'),
    )
  }

  // 404 = la pile n'est pas en `dev`. Voir l'en-tête : cela ne prouve pas qu'elle soit en
  // `test`, et une pile en `prod` passerait ici. Limite connue, documentée, non masquée.
  if (reponse.status === 404) return

  if (reponse.status === 200) {
    refuser(
      'la pile API tourne en `APP_ENV=dev`, la suite écrirait dans la base de DÉMONSTRATION.',
      REMEDE,
    )
  }

  refuser(
    `réponse inattendue de \`/api/auth/debug\` (HTTP ${reponse.status}) : impossible de confirmer que la pile n'est pas en \`dev\`.`,
    REMEDE,
  )
}

async function prechauffer(): Promise<void> {
  const debut = Date.now()
  const navigateur = await chromium.launch()
  try {
    const page = await navigateur.newPage()
    // `networkidle` : on attend que Vite ait servi tous les modules que le SPA réclame,
    // transformation comprise. C'est le coût qu'on déplace hors des assertions.
    for (const route of ['/', '/login']) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 120_000 })
    }
  } finally {
    await navigateur.close()
  }
  console.log(`  [global-setup] prechauffage Vite : ${((Date.now() - debut) / 1000).toFixed(1)} s`)
}

async function globalSetup(): Promise<void> {
  await verifierIsolation()
  await prechauffer()
}

export default globalSetup
