import { computed, ref } from 'vue'
import {
  apiEnrollmentsGetCollection,
  apiSessionsIdGet,
  apiModulesGetCollection,
  apiLessonsGetCollection,
  apiLessonCompletionsGetCollection,
  apiLessonCompletionsPost,
  apiLessonCompletionsIdPut,
  apiParcoursGetCollection,
  apiMilestonesGetCollection,
} from '@/api'
import type {
  EnrollmentEnrollmentRead,
  LessonCompletionLessonCompletionRead,
  MilestoneMilestoneRead,
  ParcoursParcoursRead,
} from '@/api'

export interface LessonRow {
  id: number
  title: string
  orderIndex: number
  lessonType: string | null
  durationMinutes: number | null
  completionId?: number
  status: 'not_started' | 'in_progress' | 'completed'
  progressPct: number
}

export interface ModuleRow {
  id: number
  title: string
  description: string
  orderIndex: number
  isPublished: boolean
  lessons: LessonRow[]
  progressPct: number
}

export function useParcours() {
  const enrollments        = ref<EnrollmentEnrollmentRead[]>([])
  const selectedEnrollment = ref<EnrollmentEnrollmentRead | null>(null)
  const modules            = ref<ModuleRow[]>([])
  const parcours           = ref<ParcoursParcoursRead | null>(null)
  const milestones         = ref<MilestoneMilestoneRead[]>([])
  const completions        = ref<LessonCompletionLessonCompletionRead[]>([])

  const loading       = ref(false)
  const loadingDetail = ref(false)
  const error         = ref<string | null>(null)

  const activeEnrollments = computed(() =>
    enrollments.value.filter((e) => e.status === 'active' || e.status === 'in_progress'),
  )

  async function fetchParcours() {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiEnrollmentsGetCollection({ query: { page: 1 } })
      if (apiError) { error.value = 'Impossible de charger votre parcours.'; return }
      enrollments.value = data ?? []
      // Auto-sélectionner si un seul enrollment actif
      const active = enrollments.value.filter((e) => e.status === 'active' || e.status === 'in_progress')
      if (active.length === 1) await selectEnrollment(active[0]!)
    } catch {
      error.value = 'Impossible de charger votre parcours.'
    } finally {
      loading.value = false
    }
  }

  async function selectEnrollment(enrollment: EnrollmentEnrollmentRead) {
    selectedEnrollment.value = enrollment
    loadingDetail.value = true
    modules.value    = []
    parcours.value   = null
    milestones.value = []
    completions.value = []

    try {
      const sessionId = enrollment.session.id
      if (!sessionId) return

      // Récupère la session pour obtenir le formation ID
      const sessionRes = await apiSessionsIdGet({ path: { id: String(sessionId) } })
      const formationId = sessionRes.data?.formation?.id
      if (!formationId) return
      const formationIri  = `/api/formations/${formationId}`
      const enrollmentIri = `/api/enrollments/${enrollment.id}`

      // Chargement parallèle
      const [modRes, lesRes, compRes, parRes, milRes] = await Promise.all([
        apiModulesGetCollection({ query: { page: 1 } }),
        apiLessonsGetCollection({ query: { page: 1 } }),
        apiLessonCompletionsGetCollection({ query: { page: 1 } }),
        apiParcoursGetCollection({ query: { page: 1 } }),
        apiMilestonesGetCollection({ query: { page: 1 } }),
      ])

      const allModules     = (modRes.data ?? []).filter((m) => m.formation === formationIri)
      const allLessons     = lesRes.data ?? []
      const allCompletions = (compRes.data ?? []).filter((c) => c.enrollment === enrollmentIri)
      completions.value    = allCompletions

      // Parcours de cet enrollment
      const myParcours = (parRes.data ?? []).find((p) => p.enrollment === enrollmentIri) ?? null
      parcours.value   = myParcours
      const parcoursIri = myParcours ? `/api/parcours/${myParcours.id}` : null

      // Jalons du parcours
      milestones.value = parcoursIri
        ? (milRes.data ?? [])
            .filter((m) => m.parcours === parcoursIri)
            .sort((a, b) => a.orderIndex - b.orderIndex)
        : []

      // Construction de l'arborescence
      const sorted = [...allModules].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))

      modules.value = sorted.map((mod): ModuleRow => {
        const modId   = mod.id!
        const modLessons = allLessons
          .filter((l) => l.module.id === modId && l.isPublished)
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((l): LessonRow => {
            const lessonIri = `/api/lessons/${l.id}`
            const comp = allCompletions.find((c) => c.lesson === lessonIri)
            const status = (comp?.status ?? 'not_started') as LessonRow['status']
            return {
              id:             l.id!,
              title:          l.title,
              orderIndex:     l.orderIndex,
              lessonType:     l.lessonType ?? null,
              durationMinutes: l.durationMinutes ?? null,
              completionId:   comp?.id,
              status,
              progressPct:    parseFloat(comp?.progressPercentage ?? '0'),
            }
          })

        const completed  = modLessons.filter((l) => l.status === 'completed').length
        const progressPct = modLessons.length > 0
          ? Math.round((completed / modLessons.length) * 100)
          : 0

        return {
          id:          modId,
          title:       mod.title,
          description: mod.description,
          orderIndex:  mod.orderIndex,
          isPublished: mod.isPublished,
          lessons:     modLessons,
          progressPct,
        }
      })
    } catch {
      error.value = 'Impossible de charger le détail de votre formation.'
    } finally {
      loadingDetail.value = false
    }
  }

  async function updateLessonStatus(lesson: LessonRow, newStatus: 'not_started' | 'in_progress' | 'completed') {
    const enrollmentIri = `/api/enrollments/${selectedEnrollment.value?.id}`
    const lessonIri     = `/api/lessons/${lesson.id}`
    const now           = new Date().toISOString()

    const body = {
      lesson:             lessonIri,
      enrollment:         enrollmentIri,
      status:             newStatus,
      progressPercentage: newStatus === 'completed' ? '100' : newStatus === 'in_progress' ? '50' : '0',
      timeSpentMinutes:   0,
      startedAt:          newStatus !== 'not_started' ? now : null,
      completedAt:        newStatus === 'completed' ? now : null,
      lastAccessedAt:     now,
    }

    let updated: LessonCompletionLessonCompletionRead | undefined

    if (lesson.completionId) {
      const { data } = await apiLessonCompletionsIdPut({
        path: { id: String(lesson.completionId) },
        body,
      })
      updated = data ?? undefined
    } else {
      const { data } = await apiLessonCompletionsPost({ body })
      updated = data ?? undefined
    }

    if (!updated) return

    // Mise à jour locale
    for (const mod of modules.value) {
      const l = mod.lessons.find((l) => l.id === lesson.id)
      if (l) {
        l.completionId = updated.id
        l.status       = updated.status as LessonRow['status']
        l.progressPct  = parseFloat(updated.progressPercentage)
        const done     = mod.lessons.filter((x) => x.status === 'completed').length
        mod.progressPct = mod.lessons.length > 0 ? Math.round((done / mod.lessons.length) * 100) : 0
        break
      }
    }
  }

  return {
    enrollments,
    activeEnrollments,
    selectedEnrollment,
    modules,
    parcours,
    milestones,
    loading,
    loadingDetail,
    error,
    fetchParcours,
    selectEnrollment,
    updateLessonStatus,
  }
}
