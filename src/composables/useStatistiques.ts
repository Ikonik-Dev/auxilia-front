import { computed, ref } from 'vue'
import {
  apiFormationStatisticsGetCollection,
  apiUserStatisticsGetCollection,
  apiFormationFeedbacksGetCollection,
} from '@/api'
import type {
  FormationStatisticFormationStatRead,
  UserStatisticUserStatisticRead,
  FormationFeedbackFeedbackRead,
} from '@/api'

export function useStatistiques() {
  const formationStats = ref<FormationStatisticFormationStatRead[]>([])
  const userStats = ref<UserStatisticUserStatisticRead[]>([])
  const feedbacks = ref<FormationFeedbackFeedbackRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // --- KPI Formations ---
  const kpiFormations = computed(() => {
    const stats = formationStats.value
    if (!stats.length) return { totalEnrollments: 0, avgCompletion: 0, avgGrade: 0 }
    const totalEnrollments = stats.reduce((s, r) => s + r.totalEnrollments, 0)
    const avgCompletion =
      stats.reduce((s, r) => s + parseFloat(r.averageCompletionRate), 0) / stats.length
    const avgGrade =
      stats.reduce((s, r) => s + parseFloat(r.averageGrade), 0) / stats.length
    return {
      totalEnrollments,
      avgCompletion: Math.round(avgCompletion * 10) / 10,
      avgGrade: Math.round(avgGrade * 10) / 10,
    }
  })

  // --- KPI Utilisateurs ---
  const kpiUsers = computed(() => {
    const stats = userStats.value
    if (!stats.length) return { totalLessons: 0, totalHours: 0, avgScore: 0 }
    const totalLessons = stats.reduce((s, r) => s + r.lessonsCompleted, 0)
    const totalHours = Math.round(
      stats.reduce((s, r) => s + r.timeSpentMinutes, 0) / 60,
    )
    const scored = stats.filter((r) => r.averageScore !== null)
    const avgScore = scored.length
      ? scored.reduce((s, r) => s + parseFloat(r.averageScore ?? '0'), 0) / scored.length
      : 0
    return { totalLessons, totalHours, avgScore: Math.round(avgScore * 10) / 10 }
  })

  // --- KPI Satisfaction ---
  const kpiSatisfaction = computed(() => {
    const fb = feedbacks.value
    if (!fb.length) return { avgOverall: 0, wouldRecommend: 0, count: 0 }
    const rated = fb.filter((f) => f.overallRating !== null && f.overallRating !== undefined)
    const avgOverall = rated.length
      ? rated.reduce((s, f) => s + (f.overallRating ?? 0), 0) / rated.length
      : 0
    const recommend = fb.filter((f) => f.wouldRecommend === true).length
    return {
      avgOverall: Math.round(avgOverall * 10) / 10,
      wouldRecommend: Math.round((recommend / fb.length) * 100),
      count: fb.length,
    }
  })

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [fsRes, usRes, fbRes] = await Promise.all([
        apiFormationStatisticsGetCollection({ query: { page: 1 } }),
        apiUserStatisticsGetCollection({ query: { page: 1 } }),
        apiFormationFeedbacksGetCollection({ query: { page: 1 } }),
      ])
      if (fsRes.error && usRes.error) {
        error.value = 'Impossible de charger les statistiques.'
      }
      formationStats.value = fsRes.data ?? []
      userStats.value = usRes.data ?? []
      feedbacks.value = fbRes.data ?? []
    } catch {
      error.value = 'Impossible de charger les statistiques.'
    } finally {
      loading.value = false
    }
  }

  return {
    formationStats,
    userStats,
    feedbacks,
    kpiFormations,
    kpiUsers,
    kpiSatisfaction,
    loading,
    error,
    fetchAll,
  }
}
