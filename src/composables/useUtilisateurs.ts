import { ref } from 'vue'
import { apiUsersGetCollection } from '@/api'
import type { UserUserRead } from '@/api'

export function useUtilisateurs() {
  const utilisateurs = ref<UserUserRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUtilisateurs(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiUsersGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger les utilisateurs.'
      } else {
        utilisateurs.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les utilisateurs.'
    } finally {
      loading.value = false
    }
  }

  return { utilisateurs, loading, error, fetchUtilisateurs }
}
