import { computed, ref } from 'vue'
import {
  apiEvaluationsGetCollection,
  apiEvaluationSubmissionsGetCollection,
  apiEvaluationSubmissionsIdgradePatch,
} from '@/api'
import type { EvaluationEvaluationRead, EvaluationSubmissionSubmissionReadUserSummary } from '@/api'

export function useEvaluations() {
  const evaluations = ref<EvaluationEvaluationRead[]>([])
  const submissions = ref<EvaluationSubmissionSubmissionReadUserSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Soumissions text_libre en attente de notation manuelle
  const pendingGrading = computed(() =>
    submissions.value.filter((s) => s.status === 'pending_review'),
  )

  async function fetchEvaluations(page = 1) {
    loading.value = true
    error.value = null
    try {
      const [evRes, subRes] = await Promise.all([
        apiEvaluationsGetCollection({ query: { page } }),
        apiEvaluationSubmissionsGetCollection({ query: { page } }),
      ])
      if (evRes.error) error.value = 'Impossible de charger les évaluations.'
      else evaluations.value = evRes.data ?? []
      if (!subRes.error) submissions.value = subRes.data ?? []
    } catch {
      error.value = 'Impossible de charger les évaluations.'
    } finally {
      loading.value = false
    }
  }

  async function gradeSubmission(
    id: number,
    score: string,
    feedback: string,
  ): Promise<EvaluationSubmissionSubmissionReadUserSummary> {
    const { data, error: apiError } = await apiEvaluationSubmissionsIdgradePatch({
      path: { id: String(id) },
      body: { score, feedback },
    })
    if (apiError || !data) throw new Error('Impossible d\'enregistrer la note.')
    return data as unknown as EvaluationSubmissionSubmissionReadUserSummary
  }

  return {
    evaluations,
    submissions,
    pendingGrading,
    loading,
    error,
    fetchEvaluations,
    gradeSubmission,
  }
}
