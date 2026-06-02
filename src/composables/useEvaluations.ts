import { computed, ref } from 'vue'
import { apiEvaluationsGetCollection, apiEvaluationSubmissionsGetCollection } from '@/api'
import type {
  EvaluationEvaluationRead,
  EvaluationSubmissionSubmissionRead,
} from '@/api'

export function useEvaluations() {
  const evaluations = ref<EvaluationEvaluationRead[]>([])
  const submissions = ref<EvaluationSubmissionSubmissionRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Soumissions en attente de notation
  const pendingGrading = computed(() =>
    submissions.value.filter((s) => s.status === 'submitted'),
  )

  async function fetchEvaluations(page = 1) {
    loading.value = true
    error.value = null
    try {
      const [evRes, subRes] = await Promise.all([
        apiEvaluationsGetCollection({ query: { page } }),
        apiEvaluationSubmissionsGetCollection({ query: { page } }),
      ])
      if (evRes.error) {
        error.value = 'Impossible de charger les évaluations.'
      } else {
        evaluations.value = evRes.data ?? []
      }
      if (!subRes.error) {
        submissions.value = subRes.data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les évaluations.'
    } finally {
      loading.value = false
    }
  }

  return { evaluations, submissions, pendingGrading, loading, error, fetchEvaluations }
}
