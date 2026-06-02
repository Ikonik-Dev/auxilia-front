<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFormations } from '@/composables/useFormations'
import FormationForm from '@/components/formations/FormationForm.vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import type { FormationFormationWrite } from '@/api'

const router = useRouter()
const auth = useAuthStore()
const { formations, loading, error, fetchFormations, createFormation } = useFormations()

const canCreate = computed(() => auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_FORMATEUR') || auth.hasRole('ROLE_DIRECTEUR'))

onMounted(() => {
  document.title = 'Formations — Auxilium'
  fetchFormations()
})

// ── Filtres ──
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const statusOptions = [
  { label: 'Toutes',    value: 'all' },
  { label: 'Actives',   value: 'active' },
  { label: 'Inactives', value: 'inactive' },
]

const filtered = computed(() => {
  let list = formations.value
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((f) => f.title.toLowerCase().includes(q) || f.code.toLowerCase().includes(q))
  if (filterStatus.value === 'active')   list = list.filter((f) => f.isActive)
  if (filterStatus.value === 'inactive') list = list.filter((f) => !f.isActive)
  return list
})

// ── Helpers ──
const LEVEL_LABELS: Record<string, string> = {
  beginner:     'Débutant',
  intermediate: 'Intermédiaire',
  advanced:     'Avancé',
  expert:       'Expert',
}
function levelLabel(level: string | null | undefined): string {
  return level ? (LEVEL_LABELS[level] ?? level) : '—'
}

function onRowClick(event: { data: { id?: number } }) {
  if (event.data.id) router.push({ name: 'formation-detail', params: { id: event.data.id } })
}

// ── Dialog création ──
const showDialog = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

function openCreate() {
  saveError.value = null
  showDialog.value = true
}

async function handleCreate(payload: Record<string, unknown>) {
  saving.value = true
  saveError.value = null
  try {
    await createFormation(payload as unknown as FormationFormationWrite)
    showDialog.value = false
    await fetchFormations()
  } catch {
    saveError.value = 'Une erreur est survenue. Vérifiez les données et réessayez.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="formations-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Formations</h1>
      <Button
        v-if="canCreate"
        label="Nouvelle formation"
        icon="pi pi-plus"
        @click="openCreate"
      />
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton" aria-label="Chargement des formations">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" border-radius="10px" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par titre ou code…"
          aria-label="Rechercher une formation"
          class="filter-search"
        />
        <Select
          v-model="filterStatus"
          :options="statusOptions"
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
        aria-label="Liste des formations"
        class="glass-table"
        row-hover
        style="cursor: pointer"
        @row-click="onRowClick"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-book" />
            <p>Aucune formation trouvée.</p>
          </div>
        </template>

        <Column field="title" header="Titre" sortable style="min-width: 200px" />
        <Column field="code" header="Code" style="width: 120px" />
        <Column header="Catégorie" style="width: 150px">
          <template #body="{ data }">{{ data.category?.name ?? '—' }}</template>
        </Column>
        <Column header="Niveau" style="width: 140px">
          <template #body="{ data }">{{ levelLabel(data.level) }}</template>
        </Column>
        <Column header="Durée (h)" style="width: 110px; text-align: right">
          <template #body="{ data }">{{ data.durationHours ?? '—' }}</template>
        </Column>
        <Column header="Statut" style="width: 100px">
          <template #body="{ data }">
            <Tag
              :value="data.isActive ? 'Actif' : 'Inactif'"
              :severity="data.isActive ? 'success' : 'secondary'"
            />
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Dialog création -->
    <Dialog
      v-model:visible="showDialog"
      modal
      header="Nouvelle formation"
      :style="{ width: '680px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <FormationForm
        :saving="saving"
        :save-error="saveError"
        @submit="handleCreate"
        @cancel="showDialog = false"
      />
    </Dialog>
  </div>
</template>

<style scoped>
.formations-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-search {
  flex: 1;
  min-width: 200px;
}

.filter-status {
  width: 170px;
}

.list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

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
  background: rgba(167, 139, 250, 0.08) !important;
}

.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626;
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
  color: #7c6fa0;
}

.empty-state .pi {
  font-size: 2rem;
  opacity: 0.4;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}

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
</style>
