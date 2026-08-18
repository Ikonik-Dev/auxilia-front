<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useInscriptions } from '@/composables/useInscriptions'
import EnrollmentForm from '@/components/inscriptions/EnrollmentForm.vue'
import type { EnrollmentEnrollmentReadUserSummary, EnrollmentEnrollmentWrite } from '@/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const auth = useAuthStore()
const toast = useToast()
const { inscriptions, loading, error, fetchInscriptions, createInscription, validateInscription, deleteInscription } =
  useInscriptions()

const canWrite = computed(() =>
  auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR') || auth.hasRole('ROLE_RESPONSABLE_PED'),
)

function getUserName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`
}

onMounted(() => {
  document.title = 'Inscriptions — Auxilium'
  fetchInscriptions()
})

// ── Filtres ──
const search = ref('')
const filterStatus = ref('all')

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En attente',       value: 'pending' },
  { label: 'Actif',            value: 'active' },
  { label: 'Terminé',          value: 'completed' },
  { label: 'Abandonné',        value: 'abandoned' },
]

const pendingCount = computed(() => inscriptions.value.filter((e) => e.status === 'pending').length)

const filtered = computed(() => {
  let list = inscriptions.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (e) =>
        e.session.name.toLowerCase().includes(q) ||
        getUserName(e.user).toLowerCase().includes(q),
    )
  }
  if (filterStatus.value !== 'all') list = list.filter((e) => e.status === filterStatus.value)
  return list
})

// ── Helpers ──
const STATUS_LABELS: Record<string, string> = {
  pending:   'En attente',
  active:    'Actif',
  completed: 'Terminé',
  abandoned: 'Abandonné',
}
const STATUS_SEVERITY: Record<string, 'warn' | 'success' | 'danger' | 'secondary' | 'info'> = {
  pending:   'warn',
  active:    'info',
  completed: 'success',
  abandoned: 'danger',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function progressValue(raw: string): number {
  const n = parseFloat(raw)
  return isNaN(n) ? 0 : Math.round(n)
}

// ── Valider une inscription pending ──
const validating = ref<number | null>(null)

async function handleValidate(enrollment: EnrollmentEnrollmentReadUserSummary) {
  if (!enrollment.id) return
  validating.value = enrollment.id
  try {
    const updated = await validateInscription(enrollment)
    const idx = inscriptions.value.findIndex((e) => e.id === enrollment.id)
    if (idx !== -1) inscriptions.value[idx] = updated
    toast.add({ severity: 'success', summary: 'Inscription validée', detail: `${getUserName(enrollment.user)} — ${enrollment.session.name}`, life: 3000 })
  } catch (e) {
    const msg = (e as Error).message === '422'
      ? 'Capacité de la session atteinte.'
      : 'Impossible de valider l\'inscription.'
    toast.add({ severity: 'error', summary: 'Erreur', detail: msg, life: 4000 })
  } finally {
    validating.value = null
  }
}

// ── Dialog création ──
const showForm   = ref(false)
const saving     = ref(false)
const saveError  = ref<string | null>(null)

async function handleCreate(payload: EnrollmentEnrollmentWrite) {
  saving.value = true
  saveError.value = null
  try {
    await createInscription(payload)
    showForm.value = false
    toast.add({ severity: 'success', summary: 'Inscription créée', life: 3000 })
    await fetchInscriptions()
  } catch (e) {
    saveError.value = (e as Error).message === '422' ? '422' : 'Une erreur est survenue.'
  } finally {
    saving.value = false
  }
}

// ── Dialog suppression ──
const showDelete  = ref(false)
const deleteTarget = ref<EnrollmentEnrollmentReadUserSummary | null>(null)
const deleting    = ref(false)

function openDelete(enrollment: EnrollmentEnrollmentReadUserSummary) {
  deleteTarget.value = enrollment
  showDelete.value = true
}

async function handleDelete() {
  if (!deleteTarget.value?.id) return
  deleting.value = true
  const ok = await deleteInscription(deleteTarget.value.id)
  deleting.value = false
  showDelete.value = false
  if (ok) {
    toast.add({ severity: 'success', summary: 'Inscription supprimée', life: 3000 })
    await fetchInscriptions()
  } else {
    toast.add({ severity: 'error', summary: 'Suppression impossible', life: 4000 })
  }
}
</script>

<template>
  <div class="inscriptions-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>
        Inscriptions
        <span v-if="pendingCount > 0" class="pending-badge">{{ pendingCount }} en attente</span>
      </h1>
      <Button v-if="canWrite" label="Nouvelle inscription" icon="pi pi-user-plus" @click="showForm = true; saveError = null" />
    </div>

    <!-- Erreur chargement -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton" aria-label="Chargement des inscriptions">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" border-radius="10px" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par stagiaire ou session…"
          aria-label="Rechercher une inscription"
          class="filter-search"
        />
        <Select
          v-model="filterStatus"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par statut"
          class="filter-status"
        />
      </div>

      <DataTable
        :value="filtered"
        paginator
        :rows="20"
        :rows-per-page-options="[10, 20, 50]"
        aria-label="Liste des inscriptions"
        class="glass-table"
        sort-field="status"
        :sort-order="1"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-user-plus" />
            <p>Aucune inscription trouvée.</p>
          </div>
        </template>

        <!-- Stagiaire -->
        <Column header="Stagiaire" style="min-width: 180px">
          <template #body="{ data }">
            <div class="user-cell">
              <div class="user-avatar-sm">
                {{ getUserName(data.user).split(' ').map((n: string) => n[0]).join('').slice(0, 2) }}
              </div>
              <span>{{ getUserName(data.user) }}</span>
            </div>
          </template>
        </Column>

        <!-- Session + Formation -->
        <Column header="Session" style="min-width: 200px">
          <template #body="{ data }">
            <div class="session-cell">
              <span class="session-name">{{ data.session.name }}</span>
            </div>
          </template>
        </Column>

        <!-- Statut -->
        <Column header="Statut" style="width: 130px" sortable sort-field="status">
          <template #body="{ data }">
            <Tag
              :value="STATUS_LABELS[data.status] ?? data.status"
              :severity="STATUS_SEVERITY[data.status] ?? 'secondary'"
            />
          </template>
        </Column>

        <!-- Progression -->
        <Column header="Progression" style="width: 140px">
          <template #body="{ data }">
            <div class="progress-cell">
              <ProgressBar
                :value="progressValue(data.progressPercentage)"
                :show-value="false"
                class="row-progress"
              />
              <span class="progress-pct">{{ progressValue(data.progressPercentage) }} %</span>
            </div>
          </template>
        </Column>

        <!-- Date inscription -->
        <Column header="Inscrit le" style="width: 115px">
          <template #body="{ data }">{{ formatDate(data.enrollmentDate) }}</template>
        </Column>

        <!-- Certificat -->
        <Column header="Certificat" style="width: 100px">
          <template #body="{ data }">
            <Tag v-if="data.certificateIssued" value="Délivré" severity="success" />
            <span v-else class="muted">—</span>
          </template>
        </Column>

        <!-- Actions -->
        <Column v-if="canWrite" header="" style="width: 110px">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                v-if="data.status === 'pending'"
                icon="pi pi-check"
                label="Valider"
                size="small"
                severity="success"
                outlined
                :loading="validating === data.id"
                @click.stop="handleValidate(data)"
              />
              <Button
                v-else
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                size="small"
                aria-label="Supprimer l'inscription"
                @click.stop="openDelete(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Dialog nouvelle inscription -->
    <Dialog
      v-model:visible="showForm"
      modal
      header="Nouvelle inscription"
      :style="{ width: '560px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <EnrollmentForm
        :saving="saving"
        :save-error="saveError"
        @submit="handleCreate"
        @cancel="showForm = false"
      />
    </Dialog>

    <!-- Dialog suppression -->
    <Dialog
      v-model:visible="showDelete"
      modal
      header="Supprimer l'inscription"
      :style="{ width: '420px' }"
      :draggable="false"
      class="glass-dialog"
    >
      <p class="delete-msg">
        Supprimer l'inscription de
        <strong>{{ deleteTarget ? getUserName(deleteTarget.user) : '' }}</strong>
        à la session <strong>{{ deleteTarget?.session.name }}</strong> ?
      </p>
      <div class="delete-actions">
        <Button label="Annuler" severity="secondary" text @click="showDelete = false" />
        <Button label="Supprimer" icon="pi pi-trash" severity="danger" :loading="deleting" @click="handleDelete" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.inscriptions-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.pending-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 0.75rem;
  padding: 0.2rem 0.6rem;
  background: #b91c1c;
  color: #fff;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
  vertical-align: middle;
}

.list-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }

.filters { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.filter-search { flex: 1; min-width: 200px; }
.filter-status { width: 190px; }

/* Table glass */
.glass-table {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
}

:deep(.p-datatable-header-cell) {
  background: rgba(237, 233, 254, 0.6) !important;
  color: #5b21b6 !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
}

:deep(.p-datatable-tbody > tr) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.12) !important;
  transition: background 0.15s;
}

:deep(.p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.07) !important;
}

/* Cells */
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.user-avatar-sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  flex-shrink: 0;
}

.session-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e1b4b;
}

.progress-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row-progress {
  flex: 1;
  height: 6px !important;
}

:deep(.row-progress.p-progressbar) {
  background: rgba(196, 181, 253, 0.3) !important;
  border-radius: 3px !important;
  height: 6px !important;
}

:deep(.row-progress .p-progressbar-value) {
  background: linear-gradient(90deg, #8b5cf6, #6366f1) !important;
  border-radius: 3px !important;
}

.progress-pct {
  font-size: 0.75rem;
  color: #6d28d9;
  font-weight: 600;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
}

.muted { color: #6b7280; }

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
  padding: 3rem 1rem;
  color: #675c9c;
}

.empty-state .pi { font-size: 2rem; opacity: 0.4; }
.empty-state p { margin: 0; font-size: 0.9rem; }

/* Dialogs */
:deep(.glass-dialog .p-dialog) {
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(24px) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  border-radius: 20px !important;
}

:deep(.glass-dialog .p-dialog-header) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2) !important;
  padding: 1.25rem 1.5rem !important;
}

:deep(.glass-dialog .p-dialog-title) {
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  color: #4c1d95 !important;
}

:deep(.glass-dialog .p-dialog-content) {
  background: transparent !important;
  padding: 1.5rem !important;
}

.delete-msg {
  margin: 0 0 1.5rem;
  color: #374151;
  line-height: 1.6;
}

.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
