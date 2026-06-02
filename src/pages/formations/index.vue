<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { useFormations } from '@/composables/useFormations'

const { formations, loading, error, fetchFormations } = useFormations()

onMounted(() => {
  document.title = 'Formations — Auxilium'
  fetchFormations()
})

// --- Filtres ---
const search = ref('')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')

const statusOptions = [
  { label: 'Toutes', value: 'all' },
  { label: 'Actives', value: 'active' },
  { label: 'Inactives', value: 'inactive' },
]

const filtered = computed(() => {
  let list = formations.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (f) => f.title.toLowerCase().includes(q) || f.code.toLowerCase().includes(q),
    )
  }
  if (filterStatus.value === 'active') list = list.filter((f) => f.isActive)
  if (filterStatus.value === 'inactive') list = list.filter((f) => !f.isActive)
  return list
})

// --- Helpers ---
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  expert: 'Expert',
}

function levelLabel(level: string | null | undefined): string {
  return level ? (LEVEL_LABELS[level] ?? level) : '—'
}
</script>

<template>
  <div class="formations-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Formations</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des formations en cours">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" class="skeleton-row" />
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
        class="formations-table"
      >
        <template #empty>
          <span class="table-empty">Aucune formation trouvée.</span>
        </template>

        <Column field="title" header="Titre" sortable style="min-width: 200px" />
        <Column field="code" header="Code" style="width: 110px" />
        <Column header="Catégorie" style="width: 140px">
          <template #body="{ data }">
            {{ data.category?.name ?? '—' }}
          </template>
        </Column>
        <Column header="Niveau" style="width: 130px">
          <template #body="{ data }">
            {{ levelLabel(data.level) }}
          </template>
        </Column>
        <Column header="Statut" style="width: 100px">
          <template #body="{ data }">
            <Tag
              :value="data.isActive ? 'Actif' : 'Inactif'"
              :severity="data.isActive ? 'success' : 'secondary'"
            />
          </template>
        </Column>
        <Column header="Durée (h)" style="width: 110px">
          <template #body="{ data }">
            {{ data.durationHours ?? '—' }}
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.formations-page {
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
  width: 160px;
}

.table-empty {
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
