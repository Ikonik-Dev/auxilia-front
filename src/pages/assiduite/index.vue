<script setup lang="ts">
import { onMounted } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import Skeleton from 'primevue/skeleton'
import type { ScheduleScheduleRead } from '@/api'
import { useAssiduite } from '@/composables/useAssiduite'

const {
  schedules,
  selectedSchedule,
  currentAttendances,
  loading,
  loadingAttendances,
  error,
  fetchSchedules,
  selectSchedule,
  saveAttendance,
} = useAssiduite()

onMounted(() => {
  document.title = 'Assiduité — Auxilium'
  fetchSchedules()
})

// --- Helpers ---
const STATUS_OPTIONS = [
  { label: 'Présent', value: 'present' },
  { label: 'Absent', value: 'absent' },
  { label: 'Retard', value: 'late' },
  { label: 'Excusé', value: 'excused' },
]

const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  absent: 'Absent',
  late: 'Retard',
  excused: 'Excusé',
}

const STATUS_SEVERITY: Record<string, 'success' | 'danger' | 'warn' | 'secondary'> = {
  present: 'success',
  absent: 'danger',
  late: 'warn',
  excused: 'secondary',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s
}
function statusSeverity(s: string): 'success' | 'danger' | 'warn' | 'secondary' {
  return STATUS_SEVERITY[s] ?? 'secondary'
}

function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function extractId(iri: string | null | undefined): string {
  if (!iri) return '?'
  return iri.split('/').pop() ?? iri
}

async function onStatusChange(userIri: string, newStatus: string, existingId?: number) {
  await saveAttendance(userIri, newStatus, existingId)
}
</script>

<template>
  <div class="assiduite-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Assiduité</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement niveau 1 -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des séances en cours">
      <Skeleton v-for="i in 5" :key="i" height="3rem" class="skeleton-row" />
    </div>

    <!-- Layout deux niveaux -->
    <div v-else class="assiduite-layout">
      <!-- Niveau 1 : liste des séances -->
      <section class="schedules-panel" aria-label="Liste des séances">
        <h2 class="panel-title">Séances</h2>

        <div v-if="schedules.length === 0" class="empty-state">
          Aucune séance disponible.
        </div>

        <ul v-else class="schedules-list" role="listbox" aria-label="Séances disponibles">
          <li
            v-for="schedule in schedules"
            :key="schedule.id"
            role="option"
            :aria-selected="selectedSchedule?.id === schedule.id"
            class="schedule-item"
            :class="{ 'schedule-item--active': selectedSchedule?.id === schedule.id }"
            tabindex="0"
            @click="selectSchedule(schedule as ScheduleScheduleRead)"
            @keydown.enter="selectSchedule(schedule as ScheduleScheduleRead)"
            @keydown.space.prevent="selectSchedule(schedule as ScheduleScheduleRead)"
          >
            <div class="schedule-title">{{ schedule.title }}</div>
            <div class="schedule-meta">
              {{ formatDatetime(schedule.startDatetime) }}
              <span v-if="schedule.location" class="schedule-location">
                — {{ schedule.location }}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <!-- Niveau 2 : feuille de présence -->
      <section class="attendance-panel" aria-label="Feuille de présence">
        <!-- Aucune séance sélectionnée -->
        <div v-if="!selectedSchedule" class="panel-placeholder">
          <i class="pi pi-calendar-check placeholder-icon" aria-hidden="true" />
          <p>Sélectionnez une séance pour gérer les présences.</p>
        </div>

        <template v-else>
          <div class="attendance-header">
            <h2 class="panel-title">{{ selectedSchedule.title }}</h2>
            <span class="attendance-date">{{ formatDatetime(selectedSchedule.startDatetime) }}</span>
          </div>

          <!-- Chargement présences -->
          <div
            v-if="loadingAttendances"
            class="skeleton-list"
            aria-label="Chargement de la feuille de présence"
          >
            <Skeleton v-for="i in 4" :key="i" height="2.75rem" class="skeleton-row" />
          </div>

          <!-- Tableau des présences -->
          <DataTable
            v-else
            :value="currentAttendances"
            aria-label="Feuille de présence de la séance"
          >
            <template #empty>
              <span class="table-empty">Aucune présence enregistrée pour cette séance.</span>
            </template>

            <Column header="Participant" style="min-width: 140px">
              <template #body="{ data }">
                #{{ extractId(data.user) }}
              </template>
            </Column>

            <Column header="Statut" style="width: 200px">
              <template #body="{ data }">
                <Select
                  :model-value="data.status"
                  :options="STATUS_OPTIONS"
                  option-label="label"
                  option-value="value"
                  :aria-label="`Statut pour le participant ${extractId(data.user)}`"
                  class="status-select"
                  @change="(e) => onStatusChange(data.user ?? '', e.value as string, data.id)"
                />
              </template>
            </Column>

            <Column header="Badge" style="width: 100px">
              <template #body="{ data }">
                <Tag
                  :value="statusLabel(data.status)"
                  :severity="statusSeverity(data.status)"
                />
              </template>
            </Column>

            <Column header="Arrivée" style="width: 100px">
              <template #body="{ data }">
                {{ data.arrivalTime ?? '—' }}
              </template>
            </Column>

            <Column header="Notes" style="min-width: 140px">
              <template #body="{ data }">
                <span class="muted">{{ data.notes ?? '—' }}</span>
              </template>
            </Column>
          </DataTable>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.assiduite-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: var(--p-border-radius-md);
  background: var(--p-red-100);
  color: var(--p-red-700);
  font-size: 0.9rem;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-row {
  border-radius: var(--p-border-radius-md);
}

.assiduite-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 0;
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-lg);
  overflow: hidden;
  min-height: 500px;
}

.panel-title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
}

/* --- Séances (gauche) --- */
.schedules-panel {
  border-right: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  padding: 1rem;
  overflow-y: auto;
}

.empty-state {
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
  text-align: center;
  padding: 1rem 0;
}

.schedules-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.schedule-item {
  padding: 0.625rem 0.75rem;
  border-radius: var(--p-border-radius-md);
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s;
}

.schedule-item:hover,
.schedule-item:focus-visible {
  background: var(--p-surface-hover);
  outline: none;
}

.schedule-item:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
}

.schedule-item--active {
  background: var(--p-primary-50);
  border-left-color: var(--p-primary-color);
}

.schedule-title {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.2rem;
}

.schedule-meta {
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

/* --- Feuille de présence (droite) --- */
.attendance-panel {
  background: var(--p-surface-ground);
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.panel-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-text-muted-color);
  text-align: center;
  gap: 1rem;
}

.placeholder-icon {
  font-size: 2.5rem;
}

.attendance-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.attendance-date {
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.status-select {
  width: 100%;
}

.table-empty,
.muted {
  color: var(--p-text-muted-color);
  font-style: italic;
  font-size: 0.85rem;
}
</style>
