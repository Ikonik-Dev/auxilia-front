<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Skeleton from 'primevue/skeleton'
import { useStatistiques } from '@/composables/useStatistiques'

const {
  formationStats,
  userStats,
  feedbacks,
  kpiFormations,
  kpiUsers,
  kpiSatisfaction,
  loading,
  error,
  fetchAll,
} = useStatistiques()

const activeTab = ref('formations')

onMounted(() => {
  document.title = 'Statistiques — Auxilium'
  fetchAll()
})

// --- Helpers ---
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

function extractId(iri: string | null | undefined): string {
  if (!iri) return '?'
  return iri.split('/').pop() ?? iri
}

function ratingBar(value: number | null | undefined): number {
  if (value === null || value === undefined) return 0
  return Math.min(100, Math.round((value / 5) * 100))
}
</script>

<template>
  <div class="statistiques-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Statistiques</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des statistiques en cours">
      <div class="kpi-skeleton">
        <Skeleton v-for="i in 3" :key="i" height="7rem" class="skeleton-kpi" />
      </div>
      <Skeleton height="300px" class="skeleton-table" />
    </div>

    <!-- Contenu -->
    <Tabs v-else v-model:value="activeTab">
      <TabList>
        <Tab value="formations" aria-controls="panel-formations">Formations</Tab>
        <Tab value="utilisateurs" aria-controls="panel-utilisateurs">Utilisateurs</Tab>
        <Tab value="satisfaction" aria-controls="panel-satisfaction">Satisfaction</Tab>
      </TabList>

      <TabPanels>

        <!-- ===== FORMATIONS ===== -->
        <TabPanel value="formations" id="panel-formations">
          <!-- KPI -->
          <div class="kpi-grid" aria-label="Indicateurs clés des formations">
            <Card class="kpi-card">
              <template #title>Inscriptions totales</template>
              <template #content>
                <span class="kpi-value">{{ kpiFormations.totalEnrollments }}</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Taux de complétion moyen</template>
              <template #content>
                <span class="kpi-value">{{ kpiFormations.avgCompletion }} %</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Note moyenne</template>
              <template #content>
                <span class="kpi-value">{{ kpiFormations.avgGrade }}</span>
              </template>
            </Card>
          </div>

          <DataTable
            :value="formationStats"
            paginator
            :rows="10"
            aria-label="Statistiques par formation"
            class="stats-table"
          >
            <template #empty>
              <span class="table-empty">Aucune statistique de formation disponible.</span>
            </template>
            <Column header="Formation" style="min-width: 140px">
              <template #body="{ data }">
                #{{ extractId(data.formation) }}
              </template>
            </Column>
            <Column header="Période" style="min-width: 180px">
              <template #body="{ data }">
                {{ formatDate(data.periodStart) }} — {{ formatDate(data.periodEnd) }}
              </template>
            </Column>
            <Column field="totalEnrollments" header="Inscriptions" style="width: 120px" sortable />
            <Column field="completedEnrollments" header="Terminés" style="width: 100px" sortable />
            <Column field="abandonedEnrollments" header="Abandons" style="width: 100px" sortable />
            <Column header="Complétion" style="width: 110px" sortable sort-field="averageCompletionRate">
              <template #body="{ data }">
                {{ parseFloat(data.averageCompletionRate).toFixed(1) }} %
              </template>
            </Column>
            <Column header="Note moy." style="width: 110px">
              <template #body="{ data }">
                {{ parseFloat(data.averageGrade).toFixed(1) }}
              </template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- ===== UTILISATEURS ===== -->
        <TabPanel value="utilisateurs" id="panel-utilisateurs">
          <div class="kpi-grid" aria-label="Indicateurs clés d'activité">
            <Card class="kpi-card">
              <template #title>Leçons terminées</template>
              <template #content>
                <span class="kpi-value">{{ kpiUsers.totalLessons }}</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Heures de formation</template>
              <template #content>
                <span class="kpi-value">{{ kpiUsers.totalHours }} h</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Score moyen</template>
              <template #content>
                <span class="kpi-value">{{ kpiUsers.avgScore }}</span>
              </template>
            </Card>
          </div>

          <DataTable
            :value="userStats"
            paginator
            :rows="10"
            aria-label="Statistiques d'activité par utilisateur"
            class="stats-table"
          >
            <template #empty>
              <span class="table-empty">Aucune statistique utilisateur disponible.</span>
            </template>
            <Column header="Utilisateur" style="width: 110px">
              <template #body="{ data }">
                #{{ extractId(data.user) }}
              </template>
            </Column>
            <Column header="Date" style="width: 110px">
              <template #body="{ data }">
                {{ formatDate(data.date) }}
              </template>
            </Column>
            <Column field="lessonsCompleted" header="Leçons" style="width: 90px" sortable />
            <Column header="Temps (h)" style="width: 100px">
              <template #body="{ data }">
                {{ (data.timeSpentMinutes / 60).toFixed(1) }}
              </template>
            </Column>
            <Column field="evaluationsTaken" header="Évals." style="width: 80px" sortable />
            <Column header="Score moy." style="width: 110px">
              <template #body="{ data }">
                {{ data.averageScore ?? '—' }}
              </template>
            </Column>
            <Column field="loginCount" header="Connexions" style="width: 110px" sortable />
          </DataTable>
        </TabPanel>

        <!-- ===== SATISFACTION ===== -->
        <TabPanel value="satisfaction" id="panel-satisfaction">
          <div class="kpi-grid" aria-label="Indicateurs de satisfaction">
            <Card class="kpi-card">
              <template #title>Note globale moyenne</template>
              <template #content>
                <span class="kpi-value">{{ kpiSatisfaction.avgOverall }} / 5</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Recommanderaient</template>
              <template #content>
                <span class="kpi-value">{{ kpiSatisfaction.wouldRecommend }} %</span>
              </template>
            </Card>
            <Card class="kpi-card">
              <template #title>Feedbacks reçus</template>
              <template #content>
                <span class="kpi-value">{{ kpiSatisfaction.count }}</span>
              </template>
            </Card>
          </div>

          <DataTable
            :value="feedbacks"
            paginator
            :rows="10"
            aria-label="Détail des feedbacks"
            class="stats-table"
          >
            <template #empty>
              <span class="table-empty">Aucun feedback disponible.</span>
            </template>
            <Column header="Formation" style="width: 110px">
              <template #body="{ data }">
                #{{ extractId(data.formation) }}
              </template>
            </Column>
            <Column header="Note globale" style="width: 120px" sortable sort-field="overallRating">
              <template #body="{ data }">
                <span :aria-label="`${data.overallRating ?? '—'} sur 5`">
                  {{ data.overallRating ?? '—' }} / 5
                </span>
              </template>
            </Column>
            <Column header="Contenu" style="width: 90px">
              <template #body="{ data }">
                {{ data.contentQuality ?? '—' }}
              </template>
            </Column>
            <Column header="Formateur" style="width: 100px">
              <template #body="{ data }">
                {{ data.formatorQuality ?? '—' }}
              </template>
            </Column>
            <Column header="Organisation" style="width: 110px">
              <template #body="{ data }">
                {{ data.organizationQuality ?? '—' }}
              </template>
            </Column>
            <Column header="Recommande" style="width: 115px">
              <template #body="{ data }">
                <span v-if="data.wouldRecommend === true" class="recommend-yes">Oui</span>
                <span v-else-if="data.wouldRecommend === false" class="recommend-no">Non</span>
                <span v-else class="muted">—</span>
              </template>
            </Column>
            <Column header="Date" style="width: 110px">
              <template #body="{ data }">
                {{ formatDate(data.createdAt) }}
              </template>
            </Column>
          </DataTable>
        </TabPanel>

      </TabPanels>
    </Tabs>
  </div>
</template>

<style scoped>
.statistiques-page {
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
  gap: 1rem;
}

.kpi-skeleton {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.skeleton-kpi {
  border-radius: var(--p-border-radius-lg);
}

.skeleton-table {
  border-radius: var(--p-border-radius-lg);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card {
  text-align: center;
}

.kpi-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.stats-table {
  margin-top: 0.25rem;
}

.table-empty,
.muted {
  color: var(--p-text-muted-color);
  font-style: italic;
}

.recommend-yes {
  color: var(--p-green-600);
  font-weight: 600;
}

.recommend-no {
  color: var(--p-red-600);
}
</style>
