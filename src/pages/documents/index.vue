<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { useDocuments } from '@/composables/useDocuments'

const { documents, loading, error, fetchDocuments } = useDocuments()

onMounted(() => {
  document.title = 'Documents — Auxilium'
  fetchDocuments()
})

// --- Filtres ---
const search = ref('')
const filterVisibility = ref('all')

const visibilityOptions = [
  { label: 'Toutes les visibilités', value: 'all' },
  { label: 'Public', value: 'public' },
  { label: 'Privé', value: 'private' },
  { label: 'Restreint', value: 'restricted' },
]

const filtered = computed(() => {
  let list = documents.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        (d.description ?? '').toLowerCase().includes(q),
    )
  }
  if (filterVisibility.value !== 'all') {
    list = list.filter((d) => d.visibility === filterVisibility.value)
  }
  return list
})

// --- Helpers ---
const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  private: 'Privé',
  restricted: 'Restreint',
}

const VISIBILITY_SEVERITY: Record<string, 'success' | 'warn' | 'secondary'> = {
  public: 'success',
  restricted: 'warn',
  private: 'secondary',
}

function visibilityLabel(v: string): string {
  return VISIBILITY_LABELS[v] ?? v
}

function visibilitySeverity(v: string): 'success' | 'warn' | 'secondary' {
  return VISIBILITY_SEVERITY[v] ?? 'secondary'
}

// Icône selon le type MIME
function mimeIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pi-file-pdf'
  if (mimeType.includes('image')) return 'pi-image'
  if (mimeType.includes('video')) return 'pi-video'
  if (mimeType.startsWith('text')) return 'pi-file-edit'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'pi-table'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'pi-desktop'
  return 'pi-file'
}

function formatSize(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  const bytes = typeof raw === 'string' ? parseFloat(raw) : raw
  if (isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}
</script>

<template>
  <div class="documents-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Documents</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des documents en cours">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" class="skeleton-row" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par titre ou description…"
          aria-label="Rechercher un document"
          class="filter-search"
        />
        <Select
          v-model="filterVisibility"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par visibilité"
          class="filter-visibility"
        />
      </div>

      <DataTable
        :value="filtered"
        paginator
        :rows="20"
        :rows-per-page-options="[10, 20, 50]"
        aria-label="Liste des documents"
      >
        <template #empty>
          <span class="table-empty">Aucun document trouvé.</span>
        </template>

        <Column header="Fichier" style="min-width: 240px">
          <template #body="{ data }">
            <span class="file-cell">
              <i :class="`pi ${mimeIcon(data.mimeType)}`" aria-hidden="true" class="file-icon" />
              <span>{{ data.title }}</span>
            </span>
          </template>
        </Column>

        <Column header="Description" style="min-width: 200px">
          <template #body="{ data }">
            <span class="description-cell">{{ data.description ?? '—' }}</span>
          </template>
        </Column>

        <Column header="Taille" style="width: 100px">
          <template #body="{ data }">
            {{ formatSize(data.fileSize) }}
          </template>
        </Column>

        <Column header="Visibilité" style="width: 120px">
          <template #body="{ data }">
            <Tag
              :value="visibilityLabel(data.visibility)"
              :severity="visibilitySeverity(data.visibility)"
            />
          </template>
        </Column>

        <Column header="Ajouté le" style="width: 110px">
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.documents-page {
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

.filter-visibility {
  width: 200px;
}

.file-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.file-icon {
  color: var(--p-primary-color);
  font-size: 1.1rem;
  flex-shrink: 0;
}

.description-cell {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.table-empty {
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
