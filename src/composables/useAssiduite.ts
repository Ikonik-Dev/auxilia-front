import { computed, ref } from 'vue'
import {
  apiSchedulesGetCollection,
  apiAttendancesGetCollection,
  apiEnrollmentsGetCollection,
  apiAttendancesPost,
  apiAttendancesIdPut,
} from '@/api'
import type { ScheduleScheduleReadUserSummary, AttendanceAttendanceRead, EnrollmentEnrollmentReadUserSummary } from '@/api'

export interface Participant {
  userIri: string
  fullName: string
  attendanceId?: number
  savedStatus?: string
}

export function useAssiduite() {
  const schedules    = ref<ScheduleScheduleReadUserSummary[]>([])
  const attendances  = ref<AttendanceAttendanceRead[]>([])
  const enrollments  = ref<EnrollmentEnrollmentReadUserSummary[]>([])
  const selectedSchedule = ref<ScheduleScheduleReadUserSummary | null>(null)
  const loading             = ref(false)
  const loadingAttendances  = ref(false)
  const error               = ref<string | null>(null)

  // Tous les inscrits actifs de la session + leur présence existante pour ce schedule
  const participants = computed((): Participant[] => {
    if (!selectedSchedule.value?.id) return []
    const sessionId   = selectedSchedule.value.session?.id
    const scheduleIri = `/api/schedules/${selectedSchedule.value.id}`
    if (!sessionId) return []

    return enrollments.value
      .filter((e) => e.session.id === sessionId && e.status === 'active')
      .map((e) => {
        const userIri  = `/api/users/${e.user.id}`
        const existing = attendances.value.find(
          (a) => a.user === userIri && a.schedule === scheduleIri,
        )
        return {
          userIri,
          fullName:     `${e.user.firstName} ${e.user.lastName}`.trim(),
          attendanceId: existing?.id,
          savedStatus:  existing?.status,
        }
      })
  })

  async function fetchSchedules() {
    loading.value = true
    error.value = null
    try {
      const [schRes, enrRes] = await Promise.all([
        apiSchedulesGetCollection({ query: { page: 1 } }),
        apiEnrollmentsGetCollection({ query: { page: 1 } }),
      ])
      if (schRes.error) error.value = 'Impossible de charger les séances.'
      else schedules.value = schRes.data ?? []
      if (!enrRes.error) enrollments.value = enrRes.data ?? []
    } catch {
      error.value = 'Impossible de charger les séances.'
    } finally {
      loading.value = false
    }
  }

  async function selectSchedule(schedule: ScheduleScheduleReadUserSummary) {
    selectedSchedule.value   = schedule
    loadingAttendances.value = true
    try {
      const { data } = await apiAttendancesGetCollection({ query: { page: 1 } })
      attendances.value = data ?? []
    } catch {
      attendances.value = []
    } finally {
      loadingAttendances.value = false
    }
  }

  // Enregistre toutes les modifications en batch (POST pour nouveau, PUT pour existant)
  async function saveBatch(
    localStatuses: Map<string, string>,
  ): Promise<{ saved: number; errors: number }> {
    if (!selectedSchedule.value?.id) return { saved: 0, errors: 0 }
    const scheduleIri = `/api/schedules/${selectedSchedule.value.id}`
    let saved = 0, errors = 0

    await Promise.allSettled(
      [...localStatuses.entries()].map(async ([userIri, status]) => {
        const existing = attendances.value.find(
          (a) => a.user === userIri && a.schedule === scheduleIri,
        )
        try {
          if (existing?.id) {
            const { data } = await apiAttendancesIdPut({
              path: { id: String(existing.id) },
              body: { status, schedule: scheduleIri, user: userIri },
            })
            if (data) {
              const idx = attendances.value.findIndex((a) => a.id === existing.id)
              if (idx !== -1) attendances.value[idx] = data
            }
          } else {
            const { data } = await apiAttendancesPost({
              body: { status, schedule: scheduleIri, user: userIri },
            })
            if (data) attendances.value.push(data)
          }
          saved++
        } catch {
          errors++
        }
      }),
    )
    return { saved, errors }
  }

  return {
    schedules,
    participants,
    selectedSchedule,
    loading,
    loadingAttendances,
    error,
    fetchSchedules,
    selectSchedule,
    saveBatch,
  }
}
