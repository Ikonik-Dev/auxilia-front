import { client } from './generated/client.gen'

// Configure le client SDK hey-api une seule fois au démarrage.
// baseUrl vide : les URLs /api/... passent par le proxy Vite (→ localhost:8080).
// credentials: 'include' : transmet les cookies HttpOnly pour le JWT.
client.setConfig({
  baseUrl: '',
  credentials: 'include',
})

// Client fetch bas niveau (auth store, endpoints hors SDK)
export { apiClient } from './client'

// Re-exporte toutes les fonctions et types générés depuis un seul point d'entrée.
// Les composables importent depuis '@/api', pas depuis '@/api/generated' directement,
// ce qui garantit que setConfig() a été exécuté avant le premier appel SDK.
export * from './generated'
