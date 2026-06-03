import { computed, ref } from 'vue'
import {
  apiFormationStatisticsGetCollection,
  apiUserStatisticsGetCollection,
  apiFormationFeedbacksGetCollection,
  apiFormationsGetCollection,
  apiUsersGetCollection,
} from '@/api'
import type {
  FormationStatisticFormationStatRead,
  UserStatisticUserStatisticRead,
  FormationFeedbackFeedbackRead,
} from '@/api'

export function useStatistiques() {
  const formationStats = ref<FormationStatisticFormationStatRead[]>([])
  const userStats      = ref<UserStatisticUserStatisticRead[]>([])
  const feedbacks      = ref<FormationFeedbackFeedbackRead[]>([])
  const formationMap   = ref(new Map<string, string>())  // IRI → title
  const userMap        = ref(new Map<string, string>())  // IRI → fullName
  const loading = ref(false)
  const error   = ref<string | null>(null)

  function getFormationName(iri: string): string {
    return formationMap.value.get(iri) ?? `#${iri.split('/').pop()}`
  }

  function getUserName(iri: string | null | undefined): string {
    if (!iri) return '—'
    return userMap.value.get(iri) ?? `#${iri.split('/').pop()}`
  }

  // ── KPI Formations ──
  const kpiFormations = computed(() => {
    const s = formationStats.value
    if (!s.length) return { totalEnrollments: 0, activeEnrollments: 0, completedEnrollments: 0, abandonedEnrollments: 0, avgCompletion: 0, avgGrade: 0 }
    return {
      totalEnrollments:     s.reduce((acc, r) => acc + r.totalEnrollments, 0),
      activeEnrollments:    s.reduce((acc, r) => acc + r.activeEnrollments, 0),
      completedEnrollments: s.reduce((acc, r) => acc + r.completedEnrollments, 0),
      abandonedEnrollments: s.reduce((acc, r) => acc + r.abandonedEnrollments, 0),
      avgCompletion: Math.round(s.reduce((acc, r) => acc + parseFloat(r.averageCompletionRate), 0) / s.length * 10) / 10,
      avgGrade:      Math.round(s.reduce((acc, r) => acc + parseFloat(r.averageGrade), 0) / s.length * 10) / 10,
    }
  })

  // ── KPI Utilisateurs ──
  const kpiUsers = computed(() => {
    const s = userStats.value
    if (!s.length) return { totalLessons: 0, totalHours: 0, avgScore: 0 }
    const scored = s.filter((r) => r.averageScore !== null)
    return {
      totalLessons: s.reduce((acc, r) => acc + r.lessonsCompleted, 0),
      totalHours:   Math.round(s.reduce((acc, r) => acc + r.timeSpentMinutes, 0) / 60),
      avgScore: scored.length
        ? Math.round(scored.reduce((acc, r) => acc + parseFloat(r.averageScore ?? '0'), 0) / scored.length * 10) / 10
        : 0,
    }
  })

  // ── KPI Satisfaction ──
  const kpiSatisfaction = computed(() => {
    const fb = feedbacks.value
    if (!fb.length) return { avgOverall: 0, wouldRecommend: 0, count: 0 }
    const rated = fb.filter((f) => f.overallRating !== null && f.overallRating !== undefined)
    const avgOverall = rated.length
      ? rated.reduce((acc, f) => acc + (f.overallRating ?? 0), 0) / rated.length
      : 0
    return {
      avgOverall:      Math.round(avgOverall * 10) / 10,
      wouldRecommend:  Math.round((fb.filter((f) => f.wouldRecommend === true).length / fb.length) * 100),
      count:           fb.length,
    }
  })

  // ── Satisfaction breakdown (bar chart) ──
  const satisfactionBreakdown = computed(() => {
    const fb = feedbacks.value
    const avg = (key: keyof FormationFeedbackFeedbackRead): number => {
      const vals = fb.filter((f) => f[key] !== null && f[key] !== undefined)
      if (!vals.length) return 0
      return Math.round(vals.reduce((acc, f) => acc + Number(f[key] ?? 0), 0) / vals.length * 10) / 10
    }
    return {
      labels: ['Contenu', 'Formateur', 'Organisation', 'Matériaux', 'Rythme', 'Pertinence'],
      values: [
        avg('contentQuality'), avg('formatorQuality'), avg('organizationQuality'),
        avg('materialsQuality'), avg('paceRating'), avg('relevanceRating'),
      ],
    }
  })

  async function fetchAll() {
    loading.value = true
    error.value   = null
    try {
      const [fsRes, usRes, fbRes, fmRes, urRes] = await Promise.all([
        apiFormationStatisticsGetCollection({ query: { page: 1 } }),
        apiUserStatisticsGetCollection({ query: { page: 1 } }),
        apiFormationFeedbacksGetCollection({ query: { page: 1 } }),
        apiFormationsGetCollection(),
        apiUsersGetCollection(),
      ])

      if (fsRes.error && usRes.error) error.value = 'Impossible de charger les statistiques.'
      // Garde contre un objet Hydra retourné au lieu d'un tableau
      formationStats.value = Array.isArray(fsRes.data) ? fsRes.data : []
      userStats.value      = Array.isArray(usRes.data) ? usRes.data : []
      feedbacks.value      = Array.isArray(fbRes.data) ? fbRes.data : []

      const fMap = new Map<string, string>()
      for (const f of fmRes.data ?? []) if (f.id) fMap.set(`/api/formations/${f.id}`, f.title)
      formationMap.value = fMap

      const uMap = new Map<string, string>()
      for (const u of urRes.data ?? []) if (u.id) uMap.set(`/api/users/${u.id}`, `${u.firstName} ${u.lastName}`)
      userMap.value = uMap
    } catch {
      error.value = 'Impossible de charger les statistiques.'
    } finally {
      loading.value = false
    }
  }

  // ── Export CSV ──
  function exportCSV(rows: Record<string, unknown>[], filename: string) {
    if (!rows.length) return
    const headers = Object.keys(rows[0]!)
    const lines   = [
      headers.join(';'),
      ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(';')),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    formationStats,
    userStats,
    feedbacks,
    formationMap,
    kpiFormations,
    kpiUsers,
    kpiSatisfaction,
    satisfactionBreakdown,
    loading,
    error,
    fetchAll,
    getFormationName,
    getUserName,
    exportCSV,
  }
}
