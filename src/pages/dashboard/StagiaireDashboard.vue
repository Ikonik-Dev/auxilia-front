<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiDashboardstagiaireGet } from '@/api'
import Card from 'primevue/card'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'

interface ActiveEnrollment {
  id: number
  formationTitle: string
  sessionName: string
  status: string
  progress: string | number
  sessionDates: { startDate: string | null; endDate: string | null }
}

interface UpcomingSchedule {
  id: number
  startDatetime: string
  endDatetime: string
  eventType: string
  formationTitle: string
  location: string | null
}

interface TodayStats {
  lessonsCompleted: number
  timeSpentMinutes: number
  evaluationsTaken: number
  averageScore: string | null
  documentsDownloaded: number
}

interface StagiaireData {
  activeEnrollments: ActiveEnrollment[]
  upcomingSchedules: UpcomingSchedule[]
  todayStats: TodayStats | null
}

const data = ref<StagiaireData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  document.title = 'Mon espace — Auxilium'
  const { data: raw, error: apiError } = await apiDashboardstagiaireGet()
  if (apiError) {
    error.value = 'Impossible de charger le tableau de bord.'
  } else {
    data.value = raw as unknown as StagiaireData
  }
  loading.value = false
})

function progressValue(progress: string | number): number {
  const n = parseFloat(String(progress))
  return isNaN(n) ? 0 : Math.round(n)
}

function statusTag(status: string): 'success' | 'warn' | 'info' | 'secondary' {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'warn'
  if (status === 'completed') return 'info'
  return 'secondary'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Actif',
    pending: 'En attente',
    completed: 'Terminé',
    abandoned: 'Abandonné',
  }
  return map[status] ?? status
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    course: 'Cours',
    exam: 'Examen',
    workshop: 'Atelier',
    seminar: 'Séminaire',
    other: 'Autre',
  }
  return map[type] ?? type
}

function fmtDatetime(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function minutesToHours(min: number): string {
  if (!min) return '0 min'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60 > 0 ? `${min % 60} min` : ''}`
}
</script>

<template>
  <div :aria-busy="loading">
    <div class="page-header">
      <h1>Mon espace</h1>
      <Tag value="Stagiaire" severity="secondary" />
    </div>

    <div v-if="error" role="alert" aria-live="assertive" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- Today's stats -->
    <div v-if="loading || data?.todayStats" class="section-block">
      <h3 class="section-title">Aujourd'hui</h3>

      <div class="today-grid">
        <template v-if="loading">
          <Card v-for="n in 3" :key="n">
            <template #content><Skeleton height="1.5rem" /></template>
          </Card>
        </template>

        <template v-else-if="data?.todayStats">
          <Card class="today-card">
            <template #content>
              <div class="today-stat">
                <i class="pi pi-book today-icon" />
                <span class="today-value">{{ data.todayStats.lessonsCompleted }}</span>
                <span class="today-label">Leçons complétées</span>
              </div>
            </template>
          </Card>
          <Card class="today-card">
            <template #content>
              <div class="today-stat">
                <i class="pi pi-clock today-icon" />
                <span class="today-value">{{ minutesToHours(data.todayStats.timeSpentMinutes) }}</span>
                <span class="today-label">Temps d'apprentissage</span>
              </div>
            </template>
          </Card>
          <Card class="today-card">
            <template #content>
              <div class="today-stat">
                <i class="pi pi-check-circle today-icon" />
                <span class="today-value">{{ data.todayStats.evaluationsTaken }}</span>
                <span class="today-label">Évaluations passées</span>
              </div>
            </template>
          </Card>
        </template>
      </div>
    </div>

    <!-- Mes formations actives -->
    <div class="section-block">
      <h3 class="section-title">Mes formations en cours</h3>

      <div v-if="loading" class="list-skeleton">
        <Skeleton v-for="n in 2" :key="n" height="5rem" class="mb-2" border-radius="16px" />
      </div>

      <div v-else-if="data?.activeEnrollments?.length" class="enrollments-list">
        <div v-for="enrollment in data.activeEnrollments" :key="enrollment.id" class="enrollment-card">
          <div class="enrollment-top">
            <div class="enrollment-info">
              <span class="enrollment-title">{{ enrollment.formationTitle }}</span>
              <span class="enrollment-session">{{ enrollment.sessionName }}</span>
            </div>
            <Tag :value="statusLabel(enrollment.status)" :severity="statusTag(enrollment.status)" />
          </div>

          <div class="progress-wrap">
            <div class="progress-label">
              <span>Progression</span>
              <span class="progress-pct">{{ progressValue(enrollment.progress) }} %</span>
            </div>
            <ProgressBar
              :value="progressValue(enrollment.progress)"
              :show-value="false"
              class="enrollment-progress"
            />
          </div>
          <div v-if="enrollment.sessionDates?.startDate || enrollment.sessionDates?.endDate" class="session-dates">
            <i class="pi pi-calendar" aria-hidden="true" />
            <span>{{ fmtDate(enrollment.sessionDates.startDate) }} → {{ fmtDate(enrollment.sessionDates.endDate) }}</span>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-graduation-cap" />
        <p>Vous n'êtes inscrit à aucune formation active.</p>
      </div>
    </div>

    <!-- Prochains événements -->
    <div class="section-block">
      <h3 class="section-title">Agenda — 7 prochains jours</h3>

      <div v-if="loading" class="list-skeleton">
        <Skeleton v-for="n in 3" :key="n" height="3.5rem" class="mb-2" border-radius="12px" />
      </div>

      <div v-else-if="data?.upcomingSchedules?.length" class="schedule-list">
        <div v-for="schedule in data.upcomingSchedules" :key="schedule.id" class="schedule-item">
          <div class="schedule-dot" />
          <div class="schedule-info">
            <span class="schedule-event">{{ eventTypeLabel(schedule.eventType) }} — {{ schedule.formationTitle }}</span>
            <span class="schedule-time">{{ fmtDatetime(schedule.startDatetime) }}</span>
            <span v-if="schedule.location" class="schedule-location">
              <i class="pi pi-map-marker" aria-hidden="true" />{{ schedule.location }}
            </span>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-calendar" />
        <p>Aucun événement prévu dans les 7 prochains jours.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-block {
  margin-top: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #4c1d95;
  margin: 0 0 1rem;
}

/* Today's stats */
.today-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.today-card :deep(.p-card-body) {
  padding: 1rem !important;
}

.today-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.today-icon {
  font-size: 1.5rem;
  background: linear-gradient(135deg, #a78bfa, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
}

.today-value {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.today-label {
  font-size: 0.75rem;
  color: #675c9c;
  font-weight: 500;
}

/* Enrollments */
.list-skeleton { display: flex; flex-direction: column; }

.enrollments-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.enrollment-card {
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 18px;
  box-shadow: 0 2px 12px rgba(139, 92, 246, 0.06);
  transition: box-shadow 0.2s, transform 0.2s;
}

.enrollment-card:hover {
  box-shadow: 0 6px 24px rgba(139, 92, 246, 0.12);
  transform: translateY(-2px);
}

.enrollment-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.enrollment-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.enrollment-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e1b4b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.enrollment-session {
  font-size: 0.75rem;
  color: #675c9c;
}

.progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #675c9c;
}

.progress-pct {
  font-weight: 600;
  color: #6d28d9;
}

.session-dates {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.625rem;
  font-size: 0.75rem;
  color: #675c9c;
}

.session-dates .pi {
  font-size: 0.7rem;
  color: #a78bfa;
}

.enrollment-progress {
  height: 8px;
  border-radius: 4px;
}

:deep(.p-progressbar) {
  background: rgba(196, 181, 253, 0.3) !important;
  border-radius: 4px !important;
  height: 8px !important;
}

:deep(.p-progressbar-value) {
  background: linear-gradient(90deg, #8b5cf6, #6366f1) !important;
  border-radius: 4px !important;
}

/* Schedule */
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  transition: background 0.15s;
}

.schedule-item:hover {
  background: rgba(255, 255, 255, 0.62);
}

.schedule-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a78bfa, #67e8f9);
  flex-shrink: 0;
}

.schedule-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.schedule-event {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
}

.schedule-time {
  font-size: 0.75rem;
  color: #675c9c;
}

.schedule-location {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.7rem;
  color: #6b7280;
}

.schedule-location .pi {
  font-size: 0.65rem;
}

.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #675c9c;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 16px;
  border: 1px dashed rgba(196, 181, 253, 0.5);
}

.empty-state .pi {
  font-size: 2rem;
  opacity: 0.4;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}
</style>
