# CLAUDE.md — Auxilium LMS (Frontend)

> Frontend Vue 3 du LMS Auxilium.
> Ce fichier est le point d'entrée pour toute session de développement agentique.

---

## 1. Architecture globale

Ce dépôt est le **frontend SPA**. Le backend API vit dans le dépôt frère :
`../auxilia-api` — Symfony 8 / API Platform 4 / PHP 8.4.

```
Auxilia/
├── auxilia-api/    ← backend (Symfony)
├── auxilia-front/  ← tu es ici (Vue 3 / TypeScript / Vite 8 / PrimeVue 4)
└── ROADMAP.md      ← source de vérité sur l'avancement et les décisions
```

**Toujours lire `../ROADMAP.md` avant de démarrer un chantier.**

---

## 2. Stack & versions exactes

| Couche | Technologie | Version |
|--------|-------------|---------|
| Framework | Vue | 3.5.* |
| Langage | TypeScript | ~6.0 |
| Build | Vite | 8.0.* |
| UI | PrimeVue | 4.5.* |
| Thème | @primeuix/themes (definePreset) | 2.0.* |
| Icons | PrimeIcons | 7.0.* |
| Charts | Chart.js | 4.5.* |
| State | Pinia | 3.0.* |
| Router | Vue Router | 4.6.* |
| API Client | @hey-api/client-fetch | 0.13.* |
| SDK gen | @hey-api/openapi-ts | 0.97.* |

---

## 3. Commandes essentielles

```bash
npm run dev            # démarrage dev (proxy /api → localhost:8080)
npm run build          # type-check + build production
npm run type-check     # vue-tsc --build (sans compiler)
npm run generate:api   # régénère src/api/generated/ depuis http://localhost:8080/api/docs.json
                       # ⚠ L'API backend doit tourner avant de lancer cette commande
npm run preview        # preview du build de production
npm run test:run       # Vitest (tests/unit/**)
npm run test:e2e       # Playwright (tests/e2e/**) — exige `npm run dev` + le backend Docker
```

### Portes de qualité

Il n'y a **pas d'ESLint configuré** (le paquet est en devDependencies mais sans fichier
de config ni branchement dans `vite.config.ts` — `npm run lint` n'existe pas). Les portes
sont donc :

| Porte | Commande | Couvre |
|-------|----------|--------|
| Types | `npm run type-check` | `src/**` **et** `tests/**` |
| Unitaire | `npm run test:run` | `tests/unit/**` |
| Build | `npm run build-only` | bundle de production |
| E2E | `npm run test:e2e` | `tests/e2e/**`, backend requis |

Les trois premières tournent en CI (`.github/workflows/front-ci.yml`) sur chaque push.
Elles ne tiennent que parce que le SDK est versionné : sans lui, aucune étape ne pourrait
s'exécuter sans backend. **Ne pas dégager `src/api/generated/` du dépôt.**

> ℹ️ **`auxilia-api` n'a aucune CI** — vérifié le 1er septembre 2026, pas de
> `.github/workflows/` dans le dépôt backend. Le motif invoqué ici jusqu'au 5 septembre 2026
> — « aucune migration ne crée le schéma » — **n'est plus vrai sur la branche de travail**
> `feat/lms-api-foundation` : le socle de migration du 4 septembre monte les 33 tables à lui
> seul, y compris pour la base de test. Il reste vrai sur `main` jusqu'à la fusion.
> **Deux obstacles réels subsistent avant de brancher une CI backend**, tous deux mesurés le
> 5 septembre 2026 et consignés dans `../ROADMAP.md` :
> 1. `bin/phpunit` rend le **code de sortie 1** alors que zéro test échoue (warning
>    « `AbstractFunctionalTest` … is abstract » + `failOnPhpunitWarning` à `true` par défaut en
>    PHPUnit 11). Une CI branchée aujourd'hui serait rouge en permanence.
> 2. En `APP_ENV=test`, Dotenv saute `.env.local` : un runner sans ce fichier tourne avec
>    `APP_SECRET` **vide** et `JWT_PASSPHRASE` sur le placeholder de `.env`. Le vert obtenu ne
>    prouverait rien d'une configuration réaliste.

> ✅ **`npm run test:e2e` n'écrit plus dans la base de démonstration — résolu le 5 septembre 2026,
> et la suite a été exécutée pour la première fois ce jour-là.**
>
> **Le piège à connaître :** le correctif backend du 5 septembre (`dbname_suffix`) **ne couvre
> pas** ce cas. Il vit dans le bloc `when@test` de `config/packages/doctrine.yaml` et ne
> s'applique qu'en `APP_ENV=test`, alors que la suite vise `localhost:5173` → proxy Vite →
> `:8080`, c'est-à-dire les conteneurs `nginx`/`php`. La solution retenue est donc de **basculer
> la pile HTTP** le temps de la suite :
> ```bash
> # 1. AVANT CHAQUE EXÉCUTION — la suite n'est PAS idempotente (voir plus bas), depuis auxilia-api/
> docker compose exec php php bin/console doctrine:fixtures:load --env=test --no-interaction
> # 2. bascule, suite, retour
> APP_ENV=test docker compose up -d php nginx      # depuis auxilia-api/
> npm run dev                                      # depuis auxilia-front/, dans un autre terminal
> npm run test:e2e
> docker compose up -d php nginx                   # RETOUR EN DEV — ne pas oublier
> ```
> *(Au tout premier usage seulement, la base de test doit d'abord être créée :
> `doctrine:migrations:migrate --env=test` — cf. `auxilia-api/CLAUDE.md` §8.)*
>
> `compose.override.yaml:24` et `:36` ont dû passer de `APP_ENV: dev` à `${APP_ENV:-dev}` :
> la valeur y était codée en dur et **écrasait silencieusement** le `${APP_ENV:-dev}` de
> `compose.yaml:12` et `:49`. Sans ce changement, `APP_ENV=test docker compose up -d` résolvait
> à `dev` sans le moindre message — et la suite polluait la démo en paraissant isolée.
>
> **Le geste humain est gardé, pas supposé.** `tests/e2e/global-setup.ts` interroge
> `/api/auth/debug` (200 en `dev`, 404 hors `dev`) et **refuse de lancer la suite** si la pile
> est en `dev`, en affichant la procédure. Il échoue à la fermeture : toute réponse autre que
> 404 est refusée.
>
> ⚠ **Ce que le garde ne prouve pas.** 404 établit « la pile n'est pas en `dev` », **jamais**
> « la pile est en `test` ». Une pile en `APP_ENV=prod` répond 404 elle aussi, or `when@prod`
> n'ajoute que des caches — **aucun `dbname_suffix`** — et la suite écrirait dans `auxilia_lms`.
> Limite connue et assumée : il n'existe aujourd'hui aucun signal HTTP propre prouvant « c'est
> test », et un discriminant bricolé serait plus fragile que la limite qu'il masque. Dette 🟡
> dans `../ROADMAP.md`. Second couplage : supprimer `/api/auth/debug` rendrait le garde
> silencieusement inopérant — le supprimer impose de réécrire `global-setup.ts` dans le même lot.
>
> **Le préchauffage n'est pas décoratif.** `global-setup.ts` charge `/` puis `/login` dans un
> navigateur avant le premier spec, ce qui force Vite à transformer les modules de route.
> Mesuré le 5 septembre : sans lui, les 3 premiers tests échouaient sur une session neuve
> (test 1 à **26,5 s** contre un `waitForURL` de 15 s) ; avec lui, préchauffage de **8,2 s** puis
> test 1 à **6,8 s**, et la suite complète passe de **9,2 min à 4,8 min**. Relever le timeout
> aurait masqué le coût au lieu de le déplacer, et il serait revenu sur une machine plus lente.
>
> 🟠 **La suite n'est PAS idempotente — rechargez les fixtures avant chaque exécution.**
> Découvert le 5 septembre 2026 en la lançant deux fois de suite. `ownership-ecriture.spec.ts:266`
> crée une `lesson_completion` et la **commite** ; au run suivant, la même paire
> `(lesson_id, enrollment_id)` heurte l'index unique `unique_lesson_enrollment` et l'API rend
> **500** au lieu de 201. Symptôme trompeur : cela ressemble à une régression applicative.
> *Preuve :* fixtures rechargées (`lesson_completion` 968 → 967), spec rejoué → `POST` 201,
> 3/3 verts. C'est la dette de déterminisme du backend qui mord ici, pas un défaut du front.
>
> **Preuve d'isolation, 5 septembre 2026** — deux suites complètes plus des rejeux, base de
> démonstration `answer`/`user`/`enrollment`/`lesson_completion` à **84 / 53 / 47 / 967 avant et
> après**. Côté test, `lesson_completion` monte à 968 : l'écriture y est bien allée.
>
> Rappel de méthode : `workers: 1` n'est pas un réglage de confort mais une contrainte —
> à 3 workers la suite saturait l'API Docker sous Windows et produisait des échecs en
> cascade qui ressemblaient à des bugs applicatifs.

⚠️ `npm run dev` **ne type-checke pas**. Un code qui tourne en dev peut casser le build.
Toujours lancer `npm run type-check` avant de considérer un chantier terminé — c'est
l'absence de ce réflexe qui a laissé le build cassé pendant un mois en 2026.

---

## 4. Structure `src/`

```
src/
├── api/
│   ├── client.ts          # Configuration du client HTTP (@hey-api/client-fetch)
│   ├── index.ts           # Re-export centralisé
│   └── generated/         # ⚠ GÉNÉRÉ AUTOMATIQUEMENT — ne jamais modifier manuellement
│                          #   VERSIONNÉ dans Git (cf. .gitignore) : c'est ce qui rend
│                          #   la CI possible sans backend. Après generate:api,
│                          #   RELIRE le diff — il expose les ruptures de contrat.
│       ├── types.gen.ts   # ~50 types TypeScript (entités backend)
│       ├── sdk.gen.ts     # Fonctions pour chaque endpoint API
│       └── client.gen.ts  # Instance client générée
│
├── composables/           # Logique métier + appels API (use*.ts)
│   ├── useFormations.ts
│   ├── useInscriptions.ts
│   ├── useEvaluations.ts
│   ├── useAssiduite.ts
│   ├── useParcours.ts
│   ├── useDocuments.ts
│   ├── useMessages.ts
│   ├── useNotifications.ts
│   ├── useStatistiques.ts
│   └── useUtilisateurs.ts
│
├── stores/
│   └── auth.ts            # Pinia — état d'authentification global
│
├── router/
│   └── index.ts           # Routes + guards rôles (beforeEach)
│
├── layouts/
│   ├── AppLayout.vue      # Layout pages authentifiées (sidebar glass)
│   └── AuthLayout.vue     # Layout login (blobs animés)
│
├── pages/                 # Une page = un dossier feature
│   ├── auth/LoginPage.vue
│   ├── dashboard/         # index.vue (redirect rôle) + 4 dashboards
│   ├── formations/        # index.vue + FormationDetailPage.vue
│   ├── utilisateurs/
│   ├── inscriptions/
│   ├── parcours/
│   ├── documents/
│   ├── messages/
│   ├── evaluations/
│   ├── assiduite/
│   ├── statistiques/
│   └── errors/ForbiddenPage.vue
│
├── components/            # Composants réutilisables par feature
│   ├── formations/FormationForm.vue
│   ├── inscriptions/EnrollmentForm.vue
│   ├── utilisateurs/UserForm.vue
│   ├── parcours/MilestonesList.vue
│   └── layout/NotificationsPanel.vue
│
├── App.vue                # Root : variables CSS globales glass + overrides PrimeVue globaux
└── main.ts                # Bootstrap : fetchMe() avant mount, AbortController 10s timeout
```

---

## 5. Conventions de code

### Appels API — SDK first
**Ne jamais écrire de `fetch()` manuel.** Utiliser exclusivement le SDK généré :

```typescript
// ✅ Correct
import { apiFormationsGet } from '@/api'
const { data } = await apiFormationsGet()

// ❌ Interdit
const res = await fetch('/api/formations', { credentials: 'include' })
```

Après toute modification d'entité backend, régénérer le SDK : `npm run generate:api`.

> **Dérogations au « jamais de `fetch()` manuel » — inventaire exhaustif, vérifié le
> 1er septembre 2026.** Il y en a **six**, pas une. Une formulation antérieure de ce
> paragraphe annonçait l'upload comme « la seule dérogation ; toute autre est un bug » :
> c'était faux et cela aurait fait passer du code légitime pour un défaut.
>
> | Emplacement | Route | Verdict |
> |---|---|---|
> | `useDocuments.ts:37` (`uploadDocument`) | `POST /api/documents` | ✅ **inévitable** — multipart, le SDK ne gère pas `FormData` |
> | `stores/auth.ts:49` (`fetchMe`) | `GET /api/auth/me` | ✅ **inévitable** — route d'`AuthController`, absente du schéma OpenAPI donc du SDK |
> | `stores/auth.ts:101` (`refresh`) | `POST /api/auth/refresh` | ✅ **inévitable** — idem |
> | `stores/auth.ts:122` (`logout`) | `POST /api/auth/logout` | ✅ **inévitable** — idem |
> | `stores/auth.ts:86` (debug) | `GET /api/auth/debug` | ✅ **inévitable** — idem, et gardé par `import.meta.env.DEV` |
> | `stores/auth.ts:72` (`login`) | `POST /api/auth/login` | ⚠️ **évitable** — l'opération **existe** dans le SDK sous le nom `loginCheckPost` (`src/api/generated/sdk.gen.ts:664`), générée par le décorateur OpenAPI de lexik-jwt |
>
> Règle exacte, donc : **tout ce qui est dans le schéma OpenAPI passe par le SDK.** Les routes
> du contrôleur custom `AuthController` n'y sont pas et ne peuvent pas y être ; l'upload
> multipart y est mais n'est pas exploitable. Le seul écart réel est `login`.

#### Édition d'un utilisateur — contrat modifié le 25 août 2026

Deux changements à connaître, sous peine d'écrire du code qui échouera en 422 :

- **`password` est devenu `plainPassword`** dans le schéma d'écriture. Le champ est
  facultatif à la mise à jour (« laisser vide pour conserver ») et obligatoire à la seule
  création.
- **Utiliser `apiUsersIdPatch`, pas `apiUsersIdPut`.** Le `PATCH`
  (`application/merge-patch+json`) ne transporte que les champs modifiés — c'est lui qui
  permet de conserver son propre email. Le type à employer est
  `UserUserWriteJsonMergePatch`, dont tous les champs sont optionnels ; il rend inutile
  l'ancien cast `as UserUserWrite`.

### Composables — pattern standard
Chaque feature a un composable `use*.ts` qui encapsule :
- L'état local (`ref`, `computed`)
- Les appels SDK
- La gestion d'erreur

Les pages ne font pas d'appel API directement — elles utilisent le composable.

### Authentification
- **Pas de token en localStorage** — décision de sécurité validée, ne pas revenir en arrière.
- L'auth repose sur les cookies HttpOnly envoyés automatiquement (`credentials: 'include'`).
- `isAuthenticated` est basé sur `user !== null` (résultat de `fetchMe()`), jamais sur un token localStorage.
- Pas d'intercepteur `Authorization: Bearer` dans `client.ts` — le cookie est envoyé automatiquement.
- **Logout** : `auth.logout()` est async et appelle `POST /api/auth/logout` avant d'effacer `user.value`. Ne jamais faire un logout en effaçant uniquement le state Pinia — les cookies HttpOnly ne sont supprimables que par le backend.
- **Exception SDK-first** : `src/stores/auth.ts` utilise `fetch()` manuellement pour les 4 endpoints auth (`/api/auth/login`, `/api/auth/me`, `/api/auth/refresh`, `/api/auth/logout`) — ces routes ne sont pas exposées via API Platform et n'ont pas de SDK généré. C'est la seule exception autorisée.

### Proxy Vite
En dev, tous les appels `/api/*` sont proxifiés vers `http://localhost:8080` avec `cookieDomainRewrite: 'localhost'`.
Ne jamais hardcoder l'URL complète du backend dans le code frontend.

### Design system — glassmorphism "Digital Lavender 2026"
Variables CSS globales définies dans `App.vue` :
```css
--glass-bg           /* rgba(255,255,255,0.55) */
--glass-bg-md        /* rgba(255,255,255,0.65) */
--glass-bg-strong    /* rgba(255,255,255,0.80) */
--glass-blur         /* blur(22px) */
--glass-border       /* rgba(196,181,253,0.35) */
--app-bg             /* gradient fixe 135deg lavender → indigo → sky → menthe */
```

Classes utilitaires globales :
- `.page-header` — titre de page avec style cohérent
- `.stats-grid` — grille de KPI cards
- `.stat-value` — valeur numérique avec gradient text violet

**Toujours utiliser `<Card>` PrimeVue** pour les containers (override glass déjà actif globalement).
**Ne jamais mettre de `background` blanc plein** sur un container — utiliser `--glass-bg`.

### Palette couleurs
- Primaire : violet `#8b5cf6` (overridé dans PrimeVue via `definePreset`)
- Accent periwinkle : `#818cf8`
- Accent cyan : `#67e8f9`
- Accent rose : `#f9a8d4`
- Accent sage : `#86efac`

---

## 6. Routeur & rôles

### Rôles utilisateurs (valeurs exactes dans `user.roles[]`)
```
ROLE_ADMIN          ← relabellisé « Superviseur » côté produit (le code garde ROLE_ADMIN)
ROLE_DIRECTEUR
ROLE_RESPONSABLE_PED
ROLE_SECRETARIAT    ← existe depuis le 21 août 2026 — VOIR L'AVERTISSEMENT CI-DESSOUS
ROLE_FORMATEUR
ROLE_USER           ← rôle de base (tous les utilisateurs)
```

> ⚠️ **`ROLE_SECRETARIAT` existe côté API mais pas côté interface.** Le compte
> `secretariat@auxilium.test` est seedé et lit documents, inscriptions et parcours via
> l'API. Mais le front ne connaît pas ce rôle : `KNOWN_ROLES`, `ROLE_LABELS`,
> `ROLE_SEVERITY` (`pages/utilisateurs/index.vue`) et `ROLE_OPTIONS`
> (`components/utilisateurs/UserForm.vue`) l'ignorent tous. Conséquences : le compte
> s'affiche « Stagiaire », atterrit sur `/dashboard/stagiaire`, et **on ne peut nommer
> personne au secrétariat depuis l'écran**. Câblage prévu à l'étape 5 de la Phase 17.

> ⚠️ **`hasRole()` ne déplie PAS `role_hierarchy`.** `stores/auth.ts` lit les rôles bruts
> renvoyés par `/api/auth/me`. Un compte qui hérite de droits côté Symfony ne les verra
> pas apparaître dans l'interface. C'est la cause du point ci-dessus.

### Guards dans `router/index.ts`
- `router.beforeEach()` vérifie `auth.user` → redirige vers `/login` si non authentifié.
- Le redirect du dashboard (`/dashboard`) utilise une fonction `redirect:` dans le router (pas de `router.replace()` dans les composants — c'était le bug BUG-2).
- `router.onError()` est câblé pour les `ChunkLoadError` → force reload (`window.location.href`).

---

## 7. Domaine métier LMS

### Valeurs de statut — toujours utiliser ces chaînes exactes

**Enrollment.status :** `pending` | `active` | `completed` | `abandoned`

**EvaluationSubmission.status :** `pending_review` | `graded`

**Attendance.status :** `present` | `absent` | `late` | `excused`

**Document.visibility :** `public` | `shared` | `private`

**Evaluation.type :** `qcm` | `text_libre` | `mix`

**Lesson.lessonType :** selon les valeurs définies côté backend (vérifier `types.gen.ts`)

### Statistiques
Les données de `FormationStatistic` et `UserStatistic` sont **pré-calculées chaque nuit** par le backend. Ne jamais recalculer côté frontend. Lire les valeurs pré-calculées telles quelles.

### Notifications
Polling toutes les 30s via `useNotifications.ts` (`startPolling`/`stopPolling`).
`stopPolling()` est appelé automatiquement dans `onUnmounted` du composable.

---

## 8. Accessibilité — WCAG 2.1 AA (non négociable)

Appliquer **sur chaque nouvelle page** :
- `<h1>` unique et descriptif
- `aria-label` sur tous les `<DataTable>`
- `aria-busy="true"` sur le wrapper pendant le chargement
- `role="alert"` sur les messages d'erreur
- `aria-label` sur les boutons icônes (sans texte visible)
- `aria-current="page"` sur le lien de navigation actif
- `document.title` mis à jour avec le nom de la page

Le `:focus-visible` global est déjà configuré dans `App.vue` (outline violet 2.5px). Ne pas écraser cet outline dans les styles scoped.

---

## 9. Gotchas connus

### DatePicker PrimeVue
Ne jamais initialiser un DatePicker range avec `ref([null, null])` — PrimeVue appelle `.getFullYear()` sur les valeurs et crash si null. Utiliser `ref<Date[] | null>(null)`.

### fetchMe() au démarrage
`main.ts` appelle `auth.fetchMe()` avant `app.mount('#app')`. Ce fetch a un timeout de **10 secondes** (AbortController). Au-delà, l'app monte quand même avec `user = null` → redirect vers `/login`. Le timeout vaut aussi pour `refresh()`. **Ne pas réduire sous 10s** — le backend Docker prend jusqu'à 4-5s au cold start.

### Login — fetchMe() silencieux
`auth.login()` throw `'Session invalide après connexion'` si `user.value` est toujours null après `fetchMe()`. Sans ce throw, un échec silencieux de fetchMe ferait résoudre `login()` normalement → `router.push` → guard → redirect `/login` sans message. Ne jamais supprimer ce throw.

### Double navigation dashboard
Ne jamais appeler `router.replace()` ou `router.push()` dans `<script setup>` d'un composant de route. La redirection rôle-aware doit être dans la fonction `redirect:` du router (cf. BUG-2 résolu).

### Lazy loading chunks
Si un import dynamique échoue (`ChunkLoadError`), `router.onError()` force un `window.location.href` reload. Ne pas intercepter ces erreurs autrement.

---

## 10. Ce qu'il ne faut pas faire

- ❌ Ne jamais écrire de `fetch()` manuel — utiliser le SDK généré (`src/api/generated/`) — **exception : `src/stores/auth.ts`** (endpoints auth non exposés via API Platform)
- ❌ Ne jamais modifier les fichiers dans `src/api/generated/` — ils sont auto-générés
- ❌ Ne jamais stocker de token en `localStorage` ou `sessionStorage`
- ❌ Ne jamais hardcoder l'URL du backend (utiliser le proxy Vite `/api`)
- ❌ Ne jamais mettre de logique d'appel API directement dans les composants de page — passer par un composable
- ❌ Ne jamais mettre de `background` blanc plein sur un container — utiliser les variables `--glass-*`
- ❌ Ne jamais écraser le `:focus-visible` global dans des styles scoped
- ❌ Ne jamais initialiser un DatePicker PrimeVue avec `[null, null]`
- ❌ Ne jamais appeler `router.replace()` dans `<script setup>` d'une page de route
- ❌ Ne pas oublier de régénérer le SDK (`npm run generate:api`) après modification backend
