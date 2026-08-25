import { ref } from 'vue'
import { apiUsersGetCollection, apiUsersPost, apiUsersIdPatch, apiUsersIdDelete } from '@/api'
import type { UserUserRead, UserUserWrite, UserUserWriteJsonMergePatch } from '@/api'

/**
 * Le mot de passe est obligatoire à la création, facultatif à l'édition — le backend
 * l'exprime désormais dans le contrat (`plainPassword` requis sur `UserUserWrite`, tous
 * les champs optionnels sur `UserUserWriteJsonMergePatch`). Plus besoin du cast qui
 * masquait l'incohérence au type-check.
 */
export type UserFormPayload = UserUserWriteJsonMergePatch

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
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUtilisateurs(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiUsersGetCollection({ query: { page } })
      if (apiError) error.value = 'Impossible de charger les utilisateurs.'
      else utilisateurs.value = data ?? []
    } catch {
      error.value = 'Impossible de charger les utilisateurs.'
    } finally {
      loading.value = false
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

  return { utilisateurs, loading, error, fetchUtilisateurs, createUser, updateUser, deleteUser }
}
