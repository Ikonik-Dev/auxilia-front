<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { useInscriptions } from '@/composables/useInscriptions'

const { inscriptions, loading, error, fetchInscriptions } = useInscriptions()

onMounted(() => {
  document.title = 'Inscriptions — Auxilium'
  fetchInscriptions()
})

// --- Filtres ---
const search = ref('')
const filterStatus = ref('all')

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Inscrit', value: 'enrolled' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Terminé', value: 'completed' },
  { label: 'Abandonné', value: 'abandoned' },
  { label: 'Annulé', value: 'cancelled' },
]

const filtered = computed(() => {
  let list = inscriptions.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter((e) => e.session.name.toLowerCase().includes(q))
  }
  if (filterStatus.value !== 'all') {
    list = list.filter((e) => e.status === filterStatus.value)
  }
  return list
})

// --- Helpers ---
const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrit',
  in_progress: 'En cours',
  completed: 'Terminé',
  abandoned: 'Abandonné',
  cancelled: 'Annulé',
  pending: 'En attente',
}

const STATUS_SEVERITY: Record<
  string,
  'success' | 'info' | 'warn' | 'danger' | 'secondary'
> = {
  enrolled: 'info',
  in_progress: 'warn',
  completed: 'success',
  abandoned: 'danger',
  cancelled: 'secondary',
  pending: 'secondary',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

function statusSeverity(
  status: string,
): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  return STATUS_SEVERITY[status] ?? 'secondary'
}

// Extrait l'identifiant numérique depuis un IRI (/api/users/42 → "42")
function extractId(iri: string): string {
  return iri.split('/').pop() ?? iri
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function progressValue(raw: string): number {
  return Math.round(parseFloat(raw))
}
</script>

<template>
  <div class="inscriptions-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Inscriptions</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des inscriptions en cours">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" class="skeleton-row" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par session…"
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
      >
        <template #empty>
          <span class="table-empty">Aucune inscription trouvée.</span>
        </template>

        <Column header="Stagiaire" style="width: 110px">
          <template #body="{ data }">
            #{{ extractId(data.user) }}
          </template>
        </Column>

        <Column header="Session" sort-field="session.name" sortable style="min-width: 180px">
          <template #body="{ data }">
            {{ data.session.name }}
          </template>
        </Column>

        <Column header="Statut" style="width: 120px">
          <template #body="{ data }">
            <Tag
              :value="statusLabel(data.status)"
              :severity="statusSeverity(data.status)"
            />
          </template>
        </Column>

        <Column header="Progression" style="width: 120px">
          <template #body="{ data }">
            {{ progressValue(data.progressPercentage) }} %
          </template>
        </Column>

        <Column header="Inscription" style="width: 120px">
          <template #body="{ data }">
            {{ formatDate(data.enrollmentDate) }}
          </template>
        </Column>

        <Column header="Début" style="width: 110px">
          <template #body="{ data }">
            {{ formatDate(data.startDate) }}
          </template>
        </Column>

        <Column header="Complétion" style="width: 110px">
          <template #body="{ data }">
            {{ formatDate(data.completionDate) }}
          </template>
        </Column>

        <Column header="Certificat" style="width: 100px">
          <template #body="{ data }">
            <Tag
              v-if="data.certificateIssued"
              value="Délivré"
              severity="success"
            />
            <span v-else class="muted">—</span>
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.inscriptions-page {
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
  width: 180px;
}

.table-empty,
.muted {
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
