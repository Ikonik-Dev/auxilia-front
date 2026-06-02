<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import { useEvaluations } from '@/composables/useEvaluations'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { evaluations, pendingGrading, loading, error, fetchEvaluations } = useEvaluations()
const activeTab = ref('evaluations')

const isFormateur = auth.hasRole('ROLE_FORMATEUR') || auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR')

onMounted(() => {
  document.title = 'Évaluations — Auxilium'
  fetchEvaluations()
})

// --- Helpers ---
const EVAL_TYPE_LABELS: Record<string, string> = {
  quiz: 'Quiz',
  assignment: 'Devoir',
  exam: 'Examen',
  practical: 'Pratique',
  project: 'Projet',
}

function evalTypeLabel(t: string | null | undefined): string {
  return t ? (EVAL_TYPE_LABELS[t] ?? t) : '—'
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function extractId(iri: string | null | undefined): string {
  if (!iri) return '?'
  return iri.split('/').pop() ?? iri
}

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  not_started: 'Non commencé',
  in_progress: 'En cours',
  submitted: 'Soumis',
  graded: 'Noté',
  failed: 'Échoué',
}

const SUBMISSION_STATUS_SEVERITY: Record<
  string,
  'secondary' | 'warn' | 'info' | 'success' | 'danger'
> = {
  not_started: 'secondary',
  in_progress: 'warn',
  submitted: 'info',
  graded: 'success',
  failed: 'danger',
}

function submissionStatusLabel(s: string): string {
  return SUBMISSION_STATUS_LABELS[s] ?? s
}
function submissionStatusSeverity(
  s: string,
): 'secondary' | 'warn' | 'info' | 'success' | 'danger' {
  return SUBMISSION_STATUS_SEVERITY[s] ?? 'secondary'
}
</script>

<template>
  <div class="evaluations-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Évaluations</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des évaluations en cours">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" class="skeleton-row" />
    </div>

    <!-- Contenu -->
    <Tabs v-else v-model:value="activeTab">
      <TabList>
        <Tab value="evaluations" aria-controls="panel-evaluations">
          Toutes les évaluations
        </Tab>
        <Tab
          v-if="isFormateur"
          value="pending"
          aria-controls="panel-pending"
        >
          À noter
          <span v-if="pendingGrading.length > 0" class="badge" aria-label="soumissions en attente">
            {{ pendingGrading.length }}
          </span>
        </Tab>
      </TabList>

      <TabPanels>
        <!-- Onglet : liste des évaluations -->
        <TabPanel value="evaluations" id="panel-evaluations">
          <DataTable
            :value="evaluations"
            paginator
            :rows="20"
            :rows-per-page-options="[10, 20, 50]"
            aria-label="Liste des évaluations"
          >
            <template #empty>
              <span class="table-empty">Aucune évaluation trouvée.</span>
            </template>

            <Column field="title" header="Titre" sortable style="min-width: 200px" />

            <Column header="Type" style="width: 120px">
              <template #body="{ data }">
                {{ evalTypeLabel(data.evaluationType) }}
              </template>
            </Column>

            <Column header="Note max" style="width: 100px">
              <template #body="{ data }">
                {{ data.maxScore }}
              </template>
            </Column>

            <Column header="Note passage" style="width: 120px">
              <template #body="{ data }">
                {{ data.passingScore }}
              </template>
            </Column>

            <Column header="Durée (min)" style="width: 120px">
              <template #body="{ data }">
                {{ data.durationMinutes ?? '—' }}
              </template>
            </Column>

            <Column header="Publié" style="width: 100px">
              <template #body="{ data }">
                <Tag
                  :value="data.isPublished ? 'Oui' : 'Non'"
                  :severity="data.isPublished ? 'success' : 'secondary'"
                />
              </template>
            </Column>

            <Column header="Obligatoire" style="width: 110px">
              <template #body="{ data }">
                <Tag
                  :value="data.isMandatory ? 'Oui' : 'Non'"
                  :severity="data.isMandatory ? 'warn' : 'secondary'"
                />
              </template>
            </Column>

            <Column header="Disponible du" style="width: 130px">
              <template #body="{ data }">
                {{ formatDate(data.availableFrom) }}
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- Onglet : à noter (formateurs) -->
        <TabPanel v-if="isFormateur" value="pending" id="panel-pending">
          <DataTable
            :value="pendingGrading"
            paginator
            :rows="20"
            aria-label="Soumissions en attente de notation"
          >
            <template #empty>
              <span class="table-empty">Aucune soumission en attente de notation.</span>
            </template>

            <Column header="Stagiaire" style="width: 110px">
              <template #body="{ data }">
                #{{ extractId(data.user) }}
              </template>
            </Column>

            <Column header="Évaluation" style="min-width: 180px">
              <template #body="{ data }">
                #{{ extractId(data.evaluation) }}
              </template>
            </Column>

            <Column header="Tentative" style="width: 100px">
              <template #body="{ data }">
                {{ data.attemptNumber }}
              </template>
            </Column>

            <Column header="Note" style="width: 90px">
              <template #body="{ data }">
                {{ data.score ?? '—' }}
              </template>
            </Column>

            <Column header="Statut" style="width: 110px">
              <template #body="{ data }">
                <Tag
                  :value="submissionStatusLabel(data.status)"
                  :severity="submissionStatusSeverity(data.status)"
                />
              </template>
            </Column>

            <Column header="Soumis le" style="width: 120px">
              <template #body="{ data }">
                {{ formatDate(data.submittedAt) }}
              </template>
            </Column>
          </DataTable>
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.evaluations-page {
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

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  border-radius: 9999px;
  background: var(--p-primary-color);
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 0.4rem;
  padding: 0 0.3rem;
}

.table-empty {
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
