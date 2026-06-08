# Auxilium Front — Frontend

## Stack

| Couche       | Technologie       |
|--------------|-------------------|
| Framework    | Vue 3             |
| Langage      | TypeScript        |
| Build        | Vite              |
| UI           | PrimeVue 4        |
| État         | Pinia             |
| Charts       | Chart.js          |
| SDK API      | @hey-api/client-fetch + openapi-ts |

---

## Démarrage local

```bash
# L'API backend doit tourner sur localhost:8080
npm install
npm run dev        # http://localhost:5173 — proxy /api → localhost:8080
```

---

## Commandes utiles

```bash
npm run build         # build production
npm run type-check    # vue-tsc --build (0 erreur attendu)
npm run generate:api  # régénère src/api/generated/ depuis http://localhost:8080/api/docs.json
```

---

## SDK TypeScript

Le SDK (`src/api/generated/`) est généré via `openapi-ts` depuis le backend API Platform.

- `types.gen.ts` — types TypeScript pour toutes les entités (~50 types)
- `sdk.gen.ts` — fonctions typées pour chaque endpoint

**Régénérer après toute modification d'entité backend :**

```bash
# API backend doit tourner sur localhost:8080
npm run generate:api
```

> **Limitation :** les DTOs dashboard (PHP `array` non typé) ne génèrent pas de types stricts. Les interfaces TypeScript correspondantes (`GlobalKpis`, `TopFormation`, etc.) sont définies localement dans chaque page dashboard.

---

## Architecture

```
src/
├── stores/          # Pinia — auth.ts (état utilisateur, login/logout/fetchMe)
├── api/             # Client SDK hey-api + re-export generated/
│   └── generated/  # Types + fonctions générés par openapi-ts (ne pas modifier)
├── composables/     # Logique métier par domaine
│   ├── useFormations.ts
│   ├── useUtilisateurs.ts
│   ├── useInscriptions.ts
│   ├── useEvaluations.ts
│   ├── useAssiduite.ts
│   ├── useParcours.ts
│   ├── useDocuments.ts
│   ├── useMessages.ts
│   ├── useNotifications.ts
│   └── useStatistiques.ts
├── pages/           # Pages Vue Router (une par domaine métier)
├── layouts/         # AppLayout (sidebar + header), AuthLayout (login)
└── components/      # Composants réutilisables par domaine
```

**Conventions :**
- Pas d'appel `fetch()` manuel dans les pages — tout passe par les composables
- Les composables importent depuis `@/api` (re-export de `@/api/generated`)
- `credentials: 'include'` requis sur tous les appels (cookies HttpOnly JWT)
- Le proxy Vite (`/api` → `localhost:8080`) est transparent en dev — pas de CORS à configurer localement
