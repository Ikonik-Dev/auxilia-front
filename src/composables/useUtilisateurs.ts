import { ref } from 'vue'
import { apiUsersGetCollection, apiUsersPost, apiUsersIdPatch, apiUsersIdDelete } from '@/api'
import { ErreurCollection, lireCollectionLd } from '@/api/collection'
import type { UserUserRead, UserUserWrite, UserUserWriteJsonMergePatch } from '@/api'

/**
 * Le mot de passe est obligatoire à la création, facultatif à l'édition — le backend
 * l'exprime désormais dans le contrat (`plainPassword` requis sur `UserUserWrite`, tous
 * les champs optionnels sur `UserUserWriteJsonMergePatch`). Plus besoin du cast qui
 * masquait l'incohérence au type-check.
 */
export type UserFormPayload = UserUserWriteJsonMergePatch

/** Ce que l'écran demande au serveur. Tout est optionnel : rien n'est un filtre par défaut. */
export interface RequeteUtilisateurs {
  page?: number
  itemsPerPage?: number
  /** Recherche partielle sur prénom OU nom OU email. */
  q?: string
  /** Rôle EXACT tel qu'il est stocké en base — `ROLE_USER` ne désigne donc que les stagiaires. */
  roles?: string
  isActive?: boolean
}

/**
 * Sur 422, API Platform renvoie une `ConstraintViolationList` ; sur 403, un `detail`.
 * Sans cette extraction, l'écran affichait un message générique pour tout code d'erreur
 * — un email déjà pris et un refus de droits étaient indiscernables pour l'utilisateur.
 */
function motifDeRefus(apiError: unknown, repli: string): string {
  const corps = apiError as
    | { violations?: Array<{ propertyPath?: string; message?: string }>; detail?: string }
    | undefined

  const motifs = (corps?.violations ?? [])
    .map((violation) => violation.message)
    .filter((message): message is string => typeof message === 'string' && message !== '')

  if (motifs.length > 0) return motifs.join(' ')
  if (typeof corps?.detail === 'string' && corps.detail !== '') return corps.detail
  return repli
}

export function useUtilisateurs() {
  const utilisateurs = ref<UserUserRead[]>([])
  /** Nombre total de fiches du périmètre APRÈS filtrage — la source du paginateur. */
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Jeton monotone contre les réponses arrivées dans le désordre.
   *
   * ⚠ LE DEBOUNCE NE SUFFIT PAS, et c'est une erreur courante de croire le contraire : il
   * ESPACE les requêtes, il ne les SÉRIALISE pas. Une requête « ben » lente et une requête
   * « benali » rapide peuvent revenir dans cet ordre ; l'écran afficherait alors les
   * résultats de « ben » — avec SON total — sous un champ qui affiche « benali ». Un écran
   * qui ment, deuxième forme, après celle que ce chantier corrige.
   */
  let jeton = 0

  async function fetchUtilisateurs(requete: RequeteUtilisateurs = {}) {
    const moi = ++jeton
    loading.value = true
    error.value = null

    // Un paramètre absent n'est pas un filtre : on ne l'envoie pas du tout.
    const query: Record<string, string | number | boolean> = { page: requete.page ?? 1 }
    if (requete.itemsPerPage !== undefined) query.itemsPerPage = requete.itemsPerPage
    if (requete.q !== undefined && requete.q !== '') query.q = requete.q
    if (requete.roles !== undefined && requete.roles !== '') query.roles = requete.roles
    if (requete.isActive !== undefined) query.isActive = requete.isActive

    try {
      const { data, error: apiError } = await apiUsersGetCollection({
        query,
        // ⚠ PAR APPEL, JAMAIS DANS `client.ts`. Poser cet en-tête globalement changerait la
        // forme de TOUTES les collections — d'un tableau nu à `{ member, totalItems }` — et
        // les onze composables se mettraient à afficher des listes vides SANS UNE SEULE
        // ERREUR DE COMPILATION, puisque tous les types générés annoncent des tableaux.
        headers: { Accept: 'application/ld+json' },
      })

      // ⚠ AVANT TOUTE ÉCRITURE, `loading` compris (cf. le `finally`). Relâcher `loading`
      // depuis une réponse périmée éteindrait `aria-busy` alors qu'un chargement court.
      if (moi !== jeton) return

      if (apiError) {
        error.value = 'Impossible de charger les utilisateurs.'
        return
      }

      // ⚠ LE TYPE GÉNÉRÉ A TORT ICI : il annonce `Array<UserUserRead>` parce que le
      // générateur n'a retenu qu'un seul type de contenu, alors que c'est l'en-tête `Accept`
      // ci-dessus qui décide de la forme. `vue-tsc` ne peut pas voir cette rupture — le type
      // ment, il n'échoue pas. Cette garde la transforme en erreur visible.
      //
      // ⚠ ON N'EXIGE PAS `membres.length === total` ICI, contrairement à `/assiduite` :
      // une page 1 sur 3 est INCOMPLÈTE PAR CONSTRUCTION, c'est le principe même de la
      // pagination. L'écart n'est une anomalie que pour une collection lue en entier.
      const { membres, total: annonce } = lireCollectionLd<UserUserRead>(data)

      utilisateurs.value = membres
      total.value = annonce
    } catch (err) {
      if (moi !== jeton) return
      error.value = err instanceof ErreurCollection
        ? err.message
        : 'Impossible de charger les utilisateurs.'
    } finally {
      if (moi === jeton) loading.value = false
    }
  }

  async function createUser(payload: UserUserWrite): Promise<UserUserRead> {
    const { data, error: apiError } = await apiUsersPost({ body: payload })
    if (apiError || !data) throw new Error(motifDeRefus(apiError, 'Impossible de créer l\'utilisateur.'))
    return data
  }

  /**
   * PATCH et non PUT : le merge-patch ne transporte que les champs réellement modifiés,
   * et c'est lui qui permet de conserver son propre email (l'entité gérée est peuplée,
   * la contrainte d'unicité s'exclut donc elle-même).
   */
  async function updateUser(id: number, payload: UserFormPayload): Promise<UserUserRead> {
    const { data, error: apiError } = await apiUsersIdPatch({
      path: { id: String(id) },
      body: payload,
    })
    if (apiError || !data) throw new Error(motifDeRefus(apiError, 'Impossible de modifier l\'utilisateur.'))
    return data
  }

  async function deleteUser(id: number): Promise<boolean> {
    const { error: apiError } = await apiUsersIdDelete({ path: { id: String(id) } })
    return !apiError
  }

  return { utilisateurs, total, loading, error, fetchUtilisateurs, createUser, updateUser, deleteUser }
}
