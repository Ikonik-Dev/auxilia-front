import { ref } from 'vue'
import { apiUsersGetCollection, apiUsersPost, apiUsersIdPut, apiUsersIdDelete } from '@/api'
import type { UserUserRead, UserUserWrite } from '@/api'

export type UserFormPayload = Omit<UserUserWrite, 'password'> & { password?: string }

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
    if (apiError || !data) throw new Error('Impossible de créer l\'utilisateur.')
    return data
  }

  async function updateUser(id: number, payload: UserFormPayload): Promise<UserUserRead> {
    const { data, error: apiError } = await apiUsersIdPut({
      path: { id: String(id) },
      body: payload as UserUserWrite,
    })
    if (apiError || !data) throw new Error('Impossible de modifier l\'utilisateur.')
    return data
  }

  async function deleteUser(id: number): Promise<boolean> {
    const { error: apiError } = await apiUsersIdDelete({ path: { id: String(id) } })
    return !apiError
  }

  return { utilisateurs, loading, error, fetchUtilisateurs, createUser, updateUser, deleteUser }
}
