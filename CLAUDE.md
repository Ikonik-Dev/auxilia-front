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
ROLE_ADMIN
ROLE_DIRECTEUR
ROLE_RESPONSABLE_PED
ROLE_FORMATEUR
ROLE_USER  ← rôle de base (tous les utilisateurs)
```

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
