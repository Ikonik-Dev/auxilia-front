<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { useUtilisateurs } from '@/composables/useUtilisateurs'

const { utilisateurs, loading, error, fetchUtilisateurs } = useUtilisateurs()

onMounted(() => {
  document.title = 'Utilisateurs — Auxilium'
  fetchUtilisateurs()
})

// --- Filtres ---
const search = ref('')
const filterRole = ref('all')

// Rôles affichables (excluant ROLE_USER de base)
const KNOWN_ROLES = [
  'ROLE_ADMIN',
  'ROLE_DIRECTEUR',
  'ROLE_FORMATEUR',
  'ROLE_RESPONSABLE_PED',
  'ROLE_USER',
]

const roleOptions = [
  { label: 'Tous les rôles', value: 'all' },
  { label: 'Admin', value: 'ROLE_ADMIN' },
  { label: 'Directeur', value: 'ROLE_DIRECTEUR' },
  { label: 'Formateur', value: 'ROLE_FORMATEUR' },
  { label: 'Responsable pédago.', value: 'ROLE_RESPONSABLE_PED' },
  { label: 'Stagiaire', value: 'ROLE_USER' },
]

const filterStatus = ref<'all' | 'active' | 'inactive'>('all')
const statusOptions = [
  { label: 'Tous', value: 'all' },
  { label: 'Actifs', value: 'active' },
  { label: 'Inactifs', value: 'inactive' },
]

const filtered = computed(() => {
  let list = utilisateurs.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
  }
  if (filterRole.value !== 'all') {
    list = list.filter((u) => u.roles.includes(filterRole.value))
  }
  if (filterStatus.value === 'active') list = list.filter((u) => u.isActive)
  if (filterStatus.value === 'inactive') list = list.filter((u) => !u.isActive)
  return list
})

// --- Helpers ---
const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN: 'Admin',
  ROLE_DIRECTEUR: 'Directeur',
  ROLE_FORMATEUR: 'Formateur',
  ROLE_RESPONSABLE_PED: 'Resp. péda.',
  ROLE_USER: 'Stagiaire',
}

const ROLE_SEVERITY: Record<string, 'danger' | 'warn' | 'info' | 'secondary'> = {
  ROLE_ADMIN: 'danger',
  ROLE_DIRECTEUR: 'warn',
  ROLE_FORMATEUR: 'info',
  ROLE_RESPONSABLE_PED: 'info',
  ROLE_USER: 'secondary',
}

function displayRoles(roles: Array<string | null>): string[] {
  return roles.filter((r): r is string => r !== null && KNOWN_ROLES.includes(r))
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}
</script>

<template>
  <div class="utilisateurs-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Utilisateurs</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des utilisateurs en cours">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" class="skeleton-row" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par nom ou email…"
          aria-label="Rechercher un utilisateur"
          class="filter-search"
        />
        <Select
          v-model="filterRole"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par rôle"
          class="filter-role"
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
        aria-label="Liste des utilisateurs"
        class="utilisateurs-table"
      >
        <template #empty>
          <span class="table-empty">Aucun utilisateur trouvé.</span>
        </template>

        <Column header="Nom" sortable sort-field="lastName" style="min-width: 180px">
          <template #body="{ data }">
            {{ data.firstName }} {{ data.lastName }}
          </template>
        </Column>

        <Column field="email" header="Email" style="min-width: 200px" />

        <Column header="Rôles" style="min-width: 200px">
          <template #body="{ data }">
            <span class="role-tags">
              <Tag
                v-for="role in displayRoles(data.roles)"
                :key="role"
                :value="ROLE_LABELS[role] ?? role"
                :severity="ROLE_SEVERITY[role] ?? 'secondary'"
                class="role-tag"
              />
            </span>
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

        <Column header="Dernière connexion" style="width: 160px">
          <template #body="{ data }">
            {{ formatDate(data.lastLoginAt) }}
          </template>
        </Column>

        <Column header="Créé le" style="width: 110px">
          <template #body="{ data }">
            {{ formatDate(data.createdAt) }}
          </template>
        </Column>
      </DataTable>
    </template>
  </div>
</template>

<style scoped>
.utilisateurs-page {
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

.filter-role,
.filter-status {
  width: 180px;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.role-tag {
  font-size: 0.75rem;
}

.table-empty {
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
