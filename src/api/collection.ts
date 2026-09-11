/**
 * Lecture des collections `application/ld+json` de l'API.
 *
 * ⚠ ÉCRIT À LA MAIN PARCE QUE LE SDK NE CONNAÎT PAS CETTE FORME, et c'est la raison d'être
 * de ce module. `types.gen.ts` déclare `ApiUsersGetCollectionResponses = { 200:
 * Array<UserUserRead> }` — INCONDITIONNELLEMENT, sans égard pour l'en-tête `Accept`. Le
 * générateur ne retient qu'un seul type de contenu par réponse. Le type généré a donc TORT
 * dès qu'on demande `application/ld+json`, et `vue-tsc` ne peut rien voir : il valide la
 * lecture d'un tableau sur un objet qui n'en est pas un.
 *
 * Conséquence, et c'est ce que ce module empêche : un `Accept` oublié ou mal posé rendrait
 * un tableau nu, sans `totalItems`, et chaque écran afficherait une liste vide SANS ERREUR.
 * Onze composables sont concernés.
 *
 * ⚠ CE MODULE NE RÉPOND PAS PAR UN BOOLÉEN, DÉLIBÉRÉMENT. Un prédicat se laisse oublier —
 * l'appel manquant ne casse rien à la compilation et ramène le trou silencieux. Une fonction
 * qui REND les membres ne se contourne pas : pour obtenir les données, il faut passer par
 * elle.
 */

/** Levée quand la réponse n'a pas la forme d'une collection JSON-LD. */
export class ErreurCollection extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErreurCollection'
  }
}

/**
 * Rend `{ membres, total }` ou LÈVE `ErreurCollection`.
 *
 * ⚠ NE COMPARE PAS `membres.length` À `total`, ET CE N'EST PAS UN OUBLI. Un écart est le
 * fonctionnement NORMAL d'une page 1 sur 3 (`/utilisateurs`) et une ANOMALIE BLOQUANTE sur
 * une collection censée être lue entière (`/assiduite`). Seul l'appelant sait laquelle des
 * deux situations est la sienne : la fonction rend les deux nombres, il décide.
 */
export function lireCollectionLd<T>(data: unknown): { membres: T[]; total: number } {
  if (typeof data !== 'object' || data === null) {
    throw new ErreurCollection(
      'Réponse inattendue du serveur : une collection JSON-LD était attendue.',
    )
  }

  const corps = data as { member?: unknown; totalItems?: unknown }

  if (!Array.isArray(corps.member) || typeof corps.totalItems !== 'number') {
    throw new ErreurCollection(
      'Réponse inattendue du serveur (format de collection). En-tête Accept manquant ou incorrect ?',
    )
  }

  return { membres: corps.member as T[], total: corps.totalItems }
}

/**
 * Rend les membres d'une collection qui DOIT avoir été lue en entier, ou LÈVE.
 *
 * ⚠ C'EST LA DÉFENSE DU CHANTIER A2, et elle est nécessaire pour deux raisons distinctes
 * qu'il ne faut pas confondre :
 *
 * 1. LA TAILLE DES DONNÉES N'EST PAS UNE GARANTIE. La plus grande session du jeu compte
 *    12 places et 8 inscrits actifs, donc tout tient sous la page de 30 — mais c'est une
 *    propriété des DONNÉES, pas du code. Rien ne plafonne une session à 30 inscrits ; le
 *    jour où l'une en compte 31, le défaut revient à l'identique et en silence.
 *
 * 2. UN `SearchFilter` ÉCHOUE OUVERT. Une valeur rejetée n'est pas une erreur : le filtre
 *    est ignoré et la collection revient ENTIÈRE (mesuré : `?schedule=abc` → 93 lignes au
 *    lieu de 8). Sans ce contrôle, une faute de frappe dans un nom de paramètre suffirait
 *    à ramener le HTTP 500.
 *
 * L'appelant doit traiter l'exception comme un BLOCAGE — pas comme une ligne de plus dans
 * un compteur d'erreurs.
 */
export function lireCollectionComplete<T>(data: unknown, quoi: string): T[] {
  const { membres, total } = lireCollectionLd<T>(data)

  if (membres.length !== total) {
    throw new ErreurCollection(
      `${quoi} : ${membres.length} éléments reçus sur ${total} annoncés. `
        + 'La lecture est incomplète.',
    )
  }

  return membres
}
