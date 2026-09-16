/**
 * Lecture d'un corps d'erreur RFC 7807 (`application/problem+json`) rendu par l'API.
 *
 * ⚠ LE SDK NE TRANSMET PAS LE CODE HTTP DANS `error`. Sur une réponse non-OK, le client généré
 * fait `throw jsonError ?? textError` (`generated/client/client.gen.ts`) : `error` EST le corps,
 * parsé s'il est JSON, sinon une chaîne. Le vrai statut se lit sur `response.status`, que le SDK
 * rend à côté (`client.gen.ts:218-220`).
 *
 * ⚠ CE MODULE NE LIT PAS `detail`, DÉLIBÉRÉMENT. `detail` est un texte destiné à un humain : il se
 * reformule, et un front qui le compare casserait sans rien dire. Le seul champ qui distingue deux
 * erreurs de même statut est `type` — un contrat, pas une phrase.
 */

/** Le `type` RFC 7807 d'un corps d'erreur, ou `null`. Affine `unknown` sans cast. */
export function typeDuProbleme(erreur: unknown): string | null {
  if (typeof erreur !== 'object' || erreur === null) return null
  return 'type' in erreur && typeof erreur.type === 'string' ? erreur.type : null
}
