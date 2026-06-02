import { ref } from 'vue'
import { apiEnrollmentsGetCollection } from '@/api'
import type { EnrollmentEnrollmentRead } from '@/api'

export function useInscriptions() {
  const inscriptions = ref<EnrollmentEnrollmentRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchInscriptions(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiEnrollmentsGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger les inscriptions.'
      } else {
        inscriptions.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les inscriptions.'
    } finally {
      loading.value = false
    }
  }

  return { inscriptions, loading, error, fetchInscriptions }
}
