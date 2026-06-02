import { ref } from 'vue'
import { apiFormationsGetCollection } from '@/api'
import type { FormationFormationRead } from '@/api'

export function useFormations() {
  const formations = ref<FormationFormationRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchFormations(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiFormationsGetCollection({
        query: { page },
      })
      if (apiError) {
        error.value = 'Impossible de charger les formations.'
      } else {
        formations.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les formations.'
    } finally {
      loading.value = false
    }
  }

  return { formations, loading, error, fetchFormations }
}
