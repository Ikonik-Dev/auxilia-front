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
  EnrollmentEnrollmentReadUserSummary,
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
  content: string | null
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
  const enrollments        = ref<EnrollmentEnrollmentReadUserSummary[]>([])
  const selectedEnrollment = ref<EnrollmentEnrollmentReadUserSummary | null>(null)
  const modules            = ref<ModuleRow[]>([])
  const parcours           = ref<ParcoursParcoursRead | null>(null)
  const milestones         = ref<MilestoneMilestoneRead[]>([])
  const completions        = ref<LessonCompletionLessonCompletionRead[]>([])

  const loading       = ref(false)
  const loadingDetail = ref(false)
  const error         = ref<string | null>(null)
  // Erreur portant sur le DÉTAIL d'une formation, distincte de `error` qui
  // masque toute la page. Un détail illisible ne doit pas effacer la liste des
  // inscriptions déjà chargées.
  const detailError   = ref<string | null>(null)

  // Seul 'active' vaut « formation en cours » — cf. CLAUDE.md §7 :
  // Enrollment.status ∈ { pending, active, completed, abandoned }.
  const activeEnrollments = computed(() =>
    enrollments.value.filter((e) => e.status === 'active'),
  )

  // Inscriptions terminées / abandonnées / en attente. Elles constituent
  // l'historique, qui doit rester consultable même quand une formation est en
  // cours — sinon un stagiaire ayant 1 `active` + 1 `completed` ne voit jamais
  // sa formation terminée.
  const inactiveEnrollments = computed(() =>
    enrollments.value.filter((e) => e.status !== 'active'),
  )

  async function fetchParcours() {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiEnrollmentsGetCollection({ query: { page: 1 } })
      if (apiError) { error.value = 'Impossible de charger votre parcours.'; return }
      enrollments.value = data ?? []
      // Auto-sélectionner si un seul enrollment actif
      const active = activeEnrollments.value
      if (active.length === 1) await selectEnrollment(active[0]!)
    } catch {
      error.value = 'Impossible de charger votre parcours.'
    } finally {
      loading.value = false
    }
  }

  async function selectEnrollment(enrollment: EnrollmentEnrollmentReadUserSummary) {
    selectedEnrollment.value = enrollment
    loadingDetail.value = true
    detailError.value = null
    modules.value    = []
    parcours.value   = null
    milestones.value = []
    completions.value = []

    try {
      const sessionId = enrollment.session.id
      if (!sessionId) {
        // Sortie muette auparavant : la page retombait sur « Aucun module
        // disponible », qui ment sur la cause réelle.
        detailError.value = 'Cette inscription n\'est rattachée à aucune session : le programme ne peut pas être affiché.'
        return
      }

      // Récupère la session pour obtenir le formation ID
      const sessionRes = await apiSessionsIdGet({ path: { id: String(sessionId) } })
      const formationId = sessionRes.data?.formation?.id
      if (!formationId) {
        detailError.value = 'La session de cette inscription n\'est rattachée à aucune formation : le programme ne peut pas être affiché.'
        return
      }
      const formationIri  = `/api/formations/${formationId}`
      const enrollmentIri = `/api/enrollments/${enrollment.id}`

      // Chargement parallèle avec filtres serveur pour éviter les problèmes de pagination
      const [modRes, lesRes, compRes, parRes, milRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiModulesGetCollection({ query: { formation: formationIri } as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiLessonsGetCollection({ query: { 'module.formation': formationIri } as any }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        apiLessonCompletionsGetCollection({ query: { enrollment: enrollmentIri } as any }),
        apiParcoursGetCollection({ query: { page: 1 } }),
        apiMilestonesGetCollection({ query: { page: 1 } }),
      ])

      const allModules     = modRes.data ?? []
      const allLessons     = lesRes.data ?? []
      const allCompletions = compRes.data ?? []
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
              id:              l.id!,
              title:           l.title,
              orderIndex:      l.orderIndex,
              lessonType:      l.lessonType ?? null,
              durationMinutes: l.durationMinutes ?? null,
              content:         l.content ?? null,
              completionId:    comp?.id,
              status,
              progressPct:     parseFloat(comp?.progressPercentage ?? '0'),
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
      // `detailError` et non `error` : l'échec porte sur une formation, pas sur
      // la page. La liste des inscriptions reste affichée.
      detailError.value = 'Impossible de charger le détail de votre formation.'
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
    inactiveEnrollments,
    selectedEnrollment,
    modules,
    parcours,
    milestones,
    loading,
    loadingDetail,
    error,
    detailError,
    fetchParcours,
    selectEnrollment,
    updateLessonStatus,
  }
}
