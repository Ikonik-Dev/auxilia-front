import { computed, ref } from 'vue'
import {
  apiSchedulesGetCollection,
  apiAttendancesGetCollection,
  apiAttendancesPost,
  apiAttendancesIdPut,
} from '@/api'
import type { ScheduleScheduleRead, AttendanceAttendanceRead } from '@/api'

export function useAssiduite() {
  const schedules = ref<ScheduleScheduleRead[]>([])
  const attendances = ref<AttendanceAttendanceRead[]>([])
  const selectedSchedule = ref<ScheduleScheduleRead | null>(null)
  const loading = ref(false)
  const loadingAttendances = ref(false)
  const error = ref<string | null>(null)

  // Présences de la séance sélectionnée (filtre par IRI de la séance)
  const currentAttendances = computed(() => {
    if (!selectedSchedule.value?.id) return []
    const iri = `/api/schedules/${selectedSchedule.value.id}`
    return attendances.value.filter((a) => a.schedule === iri)
  })

  async function fetchSchedules(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiSchedulesGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger les séances.'
      } else {
        schedules.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les séances.'
    } finally {
      loading.value = false
    }
  }

  async function selectSchedule(schedule: ScheduleScheduleRead) {
    selectedSchedule.value = schedule
    loadingAttendances.value = true
    try {
      const { data } = await apiAttendancesGetCollection({ query: { page: 1 } })
      attendances.value = data ?? []
    } catch {
      // silencieux — les présences resteront vides
    } finally {
      loadingAttendances.value = false
    }
  }

  async function saveAttendance(
    userIri: string,
    status: string,
    existingId?: number,
  ): Promise<void> {
    if (!selectedSchedule.value?.id) return
    const scheduleIri = `/api/schedules/${selectedSchedule.value.id}`
    if (existingId) {
      const { data } = await apiAttendancesIdPut({
        path: { id: String(existingId) },
        body: { status, schedule: scheduleIri, user: userIri },
      })
      if (data) {
        const idx = attendances.value.findIndex((a) => a.id === existingId)
        if (idx !== -1) attendances.value[idx] = data
      }
    } else {
      const { data } = await apiAttendancesPost({
        body: { status, schedule: scheduleIri, user: userIri },
      })
      if (data) attendances.value.push(data)
    }
  }

  return {
    schedules,
    selectedSchedule,
    currentAttendances,
    loading,
    loadingAttendances,
    error,
    fetchSchedules,
    selectSchedule,
    saveAttendance,
  }
}
