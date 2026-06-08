<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAssiduite } from '@/composables/useAssiduite'
import type { Participant } from '@/composables/useAssiduite'
import { apiUsersGetCollection } from '@/api'
import type { ScheduleScheduleRead } from '@/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Select from 'primevue/select'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const {
  schedules,
  participants,
  selectedSchedule,
  loading,
  loadingAttendances,
  error,
  fetchSchedules,
  selectSchedule,
  saveBatch,
} = useAssiduite()

// ── User lookup ──
const userMap = ref(new Map<string, string>())

async function loadUsers() {
  const { data } = await apiUsersGetCollection()
  const map = new Map<string, string>()
  for (const u of data ?? []) {
    if (u.id) map.set(`/api/users/${u.id}`, `${u.firstName} ${u.lastName}`)
  }
  userMap.value = map
}

function getUserName(iri: string): string {
  return userMap.value.get(iri) ?? `#${iri.split('/').pop()}`
}

function getUserInitials(iri: string): string {
  const name = getUserName(iri)
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2)
}

onMounted(() => {
  document.title = 'Assiduité — Auxilium'
  fetchSchedules()
  loadUsers()
})

// ── Status options ──
const STATUS_OPTIONS = [
  { label: 'Présent',  value: 'present'  },
  { label: 'Absent',   value: 'absent'   },
  { label: 'Retard',   value: 'late'     },
  { label: 'Excusé',  value: 'excused'  },
]

const STATUS_SEVERITY: Record<string, 'success' | 'danger' | 'warn' | 'secondary'> = {
  present: 'success',
  absent:  'danger',
  late:    'warn',
  excused: 'secondary',
}
const STATUS_LABELS: Record<string, string> = {
  present: 'Présent',
  absent:  'Absent',
  late:    'Retard',
  excused: 'Excusé',
}

// ── Local status map (userIri → status) ──
const localStatuses = ref(new Map<string, string>())
const isDirty = computed(() => localStatuses.value.size > 0)

// Init local statuses when participants change
watch(participants, (pts: Participant[]) => {
  localStatuses.value = new Map(
    pts.filter((p) => p.savedStatus).map((p) => [p.userIri, p.savedStatus!]),
  )
})

function getStatus(p: Participant): string {
  return localStatuses.value.get(p.userIri) ?? p.savedStatus ?? ''
}

function onStatusChange(userIri: string, val: string) {
  const next = new Map(localStatuses.value)
  next.set(userIri, val)
  localStatuses.value = next
}

// ── Raccourcis ──
function setAll(status: string) {
  const next = new Map<string, string>()
  for (const p of participants.value) next.set(p.userIri, status)
  localStatuses.value = next
}

// ── Sauvegarde batch ──
const saving = ref(false)

async function handleSave() {
  if (!isDirty.value) return
  saving.value = true
  try {
    const { saved, errors } = await saveBatch(localStatuses.value)
    if (errors === 0) {
      toast.add({ severity: 'success', summary: `${saved} présence(s) enregistrée(s)`, life: 3000 })
    } else {
      toast.add({ severity: 'warn', summary: `${saved} enregistrée(s), ${errors} erreur(s)`, life: 4000 })
    }
  } finally {
    saving.value = false
  }
}

// ── Helpers schedule ──
function formatDatetime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function formatRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const date = s.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeS = s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const timeE = e.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${timeS}–${timeE}`
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  course: 'Cours', exam: 'Examen', workshop: 'Atelier', seminar: 'Séminaire', other: 'Autre',
}
function eventTypeLabel(t: string): string { return EVENT_TYPE_LABELS[t] ?? t }

// Stats résumé
const stats = computed(() => {
  let present = 0, absent = 0, late = 0, excused = 0, none = 0
  for (const p of participants.value) {
    const s = getStatus(p)
    if (s === 'present') present++
    else if (s === 'absent') absent++
    else if (s === 'late') late++
    else if (s === 'excused') excused++
    else none++
  }
  return { present, absent, late, excused, none }
})
</script>

<template>
  <div class="assiduite-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>Assiduité</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement global -->
    <div v-else-if="loading" class="list-skeleton">
      <Skeleton v-for="i in 5" :key="i" height="3rem" border-radius="12px" />
    </div>

    <!-- Layout deux panneaux -->
    <div v-else class="assiduite-layout">

      <!-- ── Panneau gauche : liste des séances ── -->
      <aside class="schedules-panel" aria-label="Liste des séances">
        <div class="panel-header">
          <h2 class="panel-title">Séances</h2>
          <span class="panel-count">{{ schedules.length }}</span>
        </div>

        <div v-if="schedules.length === 0" class="panel-empty">
          <i class="pi pi-calendar" />
          <p>Aucune séance disponible.</p>
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
            <div class="schedule-item-top">
              <span class="schedule-type">{{ eventTypeLabel(schedule.eventType) }}</span>
              <span v-if="schedule.isMandatory" class="schedule-mandatory">Obligatoire</span>
            </div>
            <div class="schedule-title">{{ schedule.title }}</div>
            <div class="schedule-meta">
              {{ formatRange(schedule.startDatetime, schedule.endDatetime) }}
            </div>
            <div v-if="schedule.location" class="schedule-location">
              <i class="pi pi-map-marker" /> {{ schedule.location }}
            </div>
          </li>
        </ul>
      </aside>

      <!-- ── Panneau droit : feuille de présence ── -->
      <main class="attendance-panel">

        <!-- Placeholder -->
        <div v-if="!selectedSchedule" class="panel-placeholder">
          <i class="pi pi-calendar-check placeholder-icon" aria-hidden="true" />
          <p>Sélectionnez une séance pour gérer les présences.</p>
        </div>

        <template v-else>
          <!-- En-tête séance -->
          <div class="attendance-header">
            <div>
              <h2 class="attendance-title">{{ selectedSchedule.title }}</h2>
              <p class="attendance-subtitle">
                {{ formatDatetime(selectedSchedule.startDatetime) }}
                <span v-if="selectedSchedule.location"> · {{ selectedSchedule.location }}</span>
              </p>
            </div>

            <!-- Actions en-tête -->
            <div class="attendance-actions">
              <Button
                label="Tous présents"
                icon="pi pi-check-circle"
                severity="success"
                outlined
                size="small"
                :disabled="participants.length === 0 || saving"
                @click="setAll('present')"
              />
              <Button
                label="Enregistrer"
                icon="pi pi-save"
                :loading="saving"
                :disabled="!isDirty"
                @click="handleSave"
              />
            </div>
          </div>

          <!-- Stats résumé -->
          <div v-if="participants.length > 0" class="stats-bar">
            <div class="stat-chip stat-chip--success">
              <i class="pi pi-check" />{{ stats.present }} présent(s)
            </div>
            <div class="stat-chip stat-chip--danger">
              <i class="pi pi-times" />{{ stats.absent }} absent(s)
            </div>
            <div class="stat-chip stat-chip--warn">
              <i class="pi pi-clock" />{{ stats.late }} retard(s)
            </div>
            <div class="stat-chip stat-chip--secondary">
              <i class="pi pi-info-circle" />{{ stats.excused }} excusé(s)
            </div>
            <div v-if="stats.none > 0" class="stat-chip stat-chip--none">
              {{ stats.none }} non renseigné(s)
            </div>
          </div>

          <!-- Chargement présences -->
          <div v-if="loadingAttendances" class="list-skeleton">
            <Skeleton v-for="i in 4" :key="i" height="2.75rem" border-radius="8px" />
          </div>

          <!-- DataTable présences -->
          <DataTable
            v-else
            :value="participants"
            aria-label="Feuille de présence"
            class="attendance-table"
          >
            <template #empty>
              <div class="empty-state">
                <i class="pi pi-users" />
                <p>Aucun inscrit actif trouvé pour cette session.</p>
              </div>
            </template>

            <!-- Participant -->
            <Column header="Participant" style="min-width: 180px">
              <template #body="{ data }">
                <div class="user-cell">
                  <div class="user-avatar-sm" :class="`status-bg--${getStatus(data) || 'none'}`">
                    {{ getUserInitials(data.userIri) }}
                  </div>
                  <span class="user-name">{{ getUserName(data.userIri) }}</span>
                </div>
              </template>
            </Column>

            <!-- Statut (Select) -->
            <Column header="Statut" style="width: 200px">
              <template #body="{ data }">
                <Select
                  :model-value="getStatus(data)"
                  :options="STATUS_OPTIONS"
                  option-label="label"
                  option-value="value"
                  placeholder="— Non renseigné —"
                  :aria-label="`Statut de ${getUserName(data.userIri)}`"
                  class="status-select"
                  @change="(e) => onStatusChange(data.userIri, e.value as string)"
                />
              </template>
            </Column>

            <!-- Badge visuel -->
            <Column header="" style="width: 110px">
              <template #body="{ data }">
                <Tag
                  v-if="getStatus(data)"
                  :value="STATUS_LABELS[getStatus(data)] ?? getStatus(data)"
                  :severity="STATUS_SEVERITY[getStatus(data)] ?? 'secondary'"
                />
                <span v-else class="muted">—</span>
              </template>
            </Column>

            <!-- Modifié -->
            <Column header="" style="width: 80px">
              <template #body="{ data }">
                <Tag
                  v-if="localStatuses.has(data.userIri) && localStatuses.get(data.userIri) !== data.savedStatus"
                  value="Modifié"
                  severity="warn"
                />
              </template>
            </Column>
          </DataTable>

          <!-- Bouton bas de page -->
          <div v-if="participants.length > 0" class="save-footer">
            <span class="save-hint">
              <i class="pi pi-info-circle" />
              {{ isDirty ? `${localStatuses.size} présence(s) à enregistrer` : 'Toutes les présences sont à jour.' }}
            </span>
            <Button
              label="Enregistrer les présences"
              icon="pi pi-save"
              :loading="saving"
              :disabled="!isDirty"
              @click="handleSave"
            />
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<style scoped>
.assiduite-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.list-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }

/* ── Layout ── */
.assiduite-layout {
  display: grid;
  grid-template-columns: 290px 1fr;
  gap: 1rem;
  min-height: 520px;
}

/* ── Panneau gauche ── */
.schedules-panel {
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2);
}

.panel-title {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #4c1d95;
}

.panel-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: rgba(167, 139, 250, 0.2);
  color: #6d28d9;
  border-radius: 11px;
  font-size: 0.7rem;
  font-weight: 700;
}

.panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #675c9c;
  font-size: 0.875rem;
}

.panel-empty .pi { font-size: 1.5rem; opacity: 0.4; }
.panel-empty p { margin: 0; }

.schedules-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  flex: 1;
}

.schedule-item {
  padding: 0.75rem;
  border-radius: 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: background 0.15s, border-color 0.15s;
}

.schedule-item:hover { background: rgba(167, 139, 250, 0.1); }

.schedule-item:focus-visible {
  outline: 2px solid #8b5cf6;
  outline-offset: -2px;
}

.schedule-item--active {
  background: rgba(167, 139, 250, 0.15);
  border-left-color: #8b5cf6;
}

.schedule-item-top {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.schedule-type {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #8b5cf6;
  background: rgba(167, 139, 250, 0.15);
  padding: 1px 6px;
  border-radius: 6px;
}

.schedule-mandatory {
  font-size: 0.65rem;
  color: #b91c1c;
  background: rgba(252, 165, 165, 0.2);
  padding: 1px 6px;
  border-radius: 6px;
  font-weight: 600;
}

.schedule-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
  margin-bottom: 0.2rem;
}

.schedule-meta {
  font-size: 0.72rem;
  color: #675c9c;
}

.schedule-location {
  font-size: 0.7rem;
  color: #6b7280;
  margin-top: 0.2rem;
}

.schedule-location .pi { font-size: 0.65rem; }

/* ── Panneau droit ── */
.attendance-panel {
  background: rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(18px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow: hidden;
}

.panel-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #675c9c;
  text-align: center;
  gap: 1rem;
}

.placeholder-icon { font-size: 3rem; opacity: 0.3; }
.panel-placeholder p { margin: 0; font-size: 0.9rem; }

.attendance-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.attendance-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e1b4b;
  margin: 0 0 0.25rem;
}

.attendance-subtitle {
  font-size: 0.8rem;
  color: #675c9c;
  margin: 0;
}

.attendance-actions {
  display: flex;
  gap: 0.625rem;
  flex-shrink: 0;
}

/* Stats bar */
.stats-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.stat-chip .pi { font-size: 0.7rem; }

.stat-chip--success  { background: rgba(134, 239, 172, 0.25); color: #15803d; }
.stat-chip--danger   { background: rgba(252, 165, 165, 0.25); color: #b91c1c; }
.stat-chip--warn     { background: rgba(253, 230, 138, 0.3);  color: #b45309; }
.stat-chip--secondary{ background: rgba(196, 181, 253, 0.2);  color: #6d28d9; }
.stat-chip--none     { background: rgba(0,0,0,0.05); color: #6b7280; }

/* Table */
.attendance-table {
  background: transparent !important;
}

:deep(.attendance-table .p-datatable-header-cell) {
  background: rgba(237, 233, 254, 0.5) !important;
  color: #5b21b6 !important;
  font-size: 0.72rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
}

:deep(.attendance-table .p-datatable-tbody > tr) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.1) !important;
}

:deep(.attendance-table .p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.06) !important;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.user-avatar-sm {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  flex-shrink: 0;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95;
  transition: background 0.2s;
}

.status-bg--present  { background: linear-gradient(135deg, #86efac, #6ee7b7); color: #15803d; }
.status-bg--absent   { background: linear-gradient(135deg, #fca5a5, #f87171); color: #991b1b; }
.status-bg--late     { background: linear-gradient(135deg, #fde68a, #fcd34d); color: #92400e; }
.status-bg--excused  { background: linear-gradient(135deg, #c4b5fd, #93c5fd); color: #4c1d95; }

.user-name { font-size: 0.875rem; font-weight: 500; color: #1e1b4b; }

.status-select { width: 100%; }

/* Footer */
.save-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
  flex-wrap: wrap;
}

.save-hint {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #675c9c;
}

.save-hint .pi { color: #8b5cf6; }

/* Error / empty */
.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: #675c9c;
}

.empty-state .pi { font-size: 1.5rem; opacity: 0.4; }
.empty-state p { margin: 0; font-size: 0.875rem; }

.muted { color: #6b7280; font-style: italic; font-size: 0.85rem; }
</style>
