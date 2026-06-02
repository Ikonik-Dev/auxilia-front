import { ref } from 'vue'
import { apiEnrollmentsGetCollection } from '@/api'
import type { EnrollmentEnrollmentRead } from '@/api'

export function useParcours() {
  const enrollments = ref<EnrollmentEnrollmentRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchParcours(page = 1) {
    loading.value = true
    error.value = null
    try {
      // Le backend filtre automatiquement les enrollments de l'utilisateur connecté
      const { data, error: apiError } = await apiEnrollmentsGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger votre parcours.'
      } else {
        enrollments.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger votre parcours.'
    } finally {
      loading.value = false
    }
  }

  return { enrollments, loading, error, fetchParcours }
}
