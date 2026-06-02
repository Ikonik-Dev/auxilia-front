<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { useStatistiques } from '@/composables/useStatistiques'
import Tabs        from 'primevue/tabs'
import TabList     from 'primevue/tablist'
import Tab         from 'primevue/tab'
import TabPanels   from 'primevue/tabpanels'
import TabPanel    from 'primevue/tabpanel'
import Card        from 'primevue/card'
import Chart       from 'primevue/chart'
import DataTable   from 'primevue/datatable'
import Column      from 'primevue/column'
import Button      from 'primevue/button'
import DatePicker  from 'primevue/datepicker'
import Skeleton    from 'primevue/skeleton'
import Tag         from 'primevue/tag'

// ── Chart.js registration ──
ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
)

const {
  formationStats, userStats, feedbacks, kpiFormations, kpiUsers,
  kpiSatisfaction, satisfactionBreakdown, loading, error,
  fetchAll, getFormationName, getUserName, exportCSV,
} = useStatistiques()

const activeTab = ref('formations')

onMounted(() => {
  document.title = 'Statistiques — Auxilium'
  fetchAll()
})

// ── Filtre de période ──
const dateRange = ref<[Date | null, Date | null]>([null, null])

const filteredFormationStats = computed(() => {
  const [from, to] = dateRange.value
  if (!from && !to) return formationStats.value
  return formationStats.value.filter((s) => {
    const start = new Date(s.periodStart)
    if (from && start < from) return false
    if (to   && start > to)   return false
    return true
  })
})

// ── Chart colors ──
const VIOLET  = 'rgba(139, 92, 246, 0.80)'
const INDIGO  = 'rgba( 99, 102, 241, 0.80)'
const CYAN    = 'rgba(103, 232, 249, 0.80)'
const GREEN   = 'rgba(134, 239, 172, 0.80)'
const RED     = 'rgba(252, 165, 165, 0.80)'
const AMBER   = 'rgba(253, 211, 77,  0.80)'

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: 'rgba(30,27,75,0.9)', titleColor: '#c4b5fd', bodyColor: '#e9d5ff' },
  },
  scales: {
    x: { grid: { color: 'rgba(196,181,253,0.15)' }, ticks: { color: '#7c6fa0', font: { family: 'Inter' } } },
    y: { grid: { color: 'rgba(196,181,253,0.15)' }, ticks: { color: '#7c6fa0', font: { family: 'Inter' } }, beginAtZero: true },
  },
}

const pieOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { color: '#4c1d95', font: { family: 'Inter' }, padding: 16 } },
    tooltip: { backgroundColor: 'rgba(30,27,75,0.9)', titleColor: '#c4b5fd', bodyColor: '#e9d5ff' },
  },
}

// ── Line chart : completion rate over time ──
const lineChartData = computed(() => {
  const stats = filteredFormationStats.value.slice().sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  return {
    labels: stats.map((s) => new Date(s.periodStart).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })),
    datasets: [{
      label: 'Taux de complétion (%)',
      data: stats.map((s) => parseFloat(s.averageCompletionRate)),
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139,92,246,0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#8b5cf6',
      pointRadius: 4,
    }],
  }
})

const lineChartOptions = {
  ...chartOptions,
  scales: {
    ...chartOptions.scales,
    y: { ...chartOptions.scales.y, max: 100, ticks: { ...chartOptions.scales.y.ticks, callback: (v: unknown) => `${v} %` } },
  },
}

// ── Bar chart : top formations par inscriptions ──
const barChartData = computed(() => {
  const top = [...filteredFormationStats.value]
    .sort((a, b) => b.totalEnrollments - a.totalEnrollments)
    .slice(0, 8)
  return {
    labels: top.map((s) => {
      const name = getFormationName(s.formation)
      return name.length > 22 ? name.slice(0, 20) + '…' : name
    }),
    datasets: [{
      label: 'Inscriptions',
      data: top.map((s) => s.totalEnrollments),
      backgroundColor: VIOLET,
      borderRadius: 6,
    }],
  }
})

// ── Pie chart : répartition enrollment statuts ──
const pieChartData = computed(() => ({
  labels: ['Actives', 'Terminées', 'Abandonnées'],
  datasets: [{
    data: [kpiFormations.value.activeEnrollments, kpiFormations.value.completedEnrollments, kpiFormations.value.abandonedEnrollments],
    backgroundColor: [CYAN, GREEN, RED],
    borderWidth: 0,
  }],
}))

// ── Bar chart : satisfaction breakdown ──
const satisfactionBarData = computed(() => ({
  labels: satisfactionBreakdown.value.labels,
  datasets: [{
    label: 'Note / 5',
    data: satisfactionBreakdown.value.values,
    backgroundColor: satisfactionBreakdown.value.values.map((v) =>
      v >= 4 ? GREEN : v >= 3 ? AMBER : RED,
    ),
    borderRadius: 6,
  }],
}))

const satisfactionBarOptions = {
  ...chartOptions,
  scales: {
    ...chartOptions.scales,
    y: { ...chartOptions.scales.y, max: 5, ticks: { ...chartOptions.scales.y.ticks, stepSize: 1 } },
  },
}

// ── Helpers ──
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

// ── Export CSV ──
function exportFormations() {
  exportCSV(
    filteredFormationStats.value.map((s) => ({
      Formation: getFormationName(s.formation),
      'Période début': s.periodStart,
      'Période fin':   s.periodEnd,
      'Inscriptions':  s.totalEnrollments,
      'Actives':       s.activeEnrollments,
      'Terminées':     s.completedEnrollments,
      'Abandonnées':   s.abandonedEnrollments,
      'Taux complétion (%)': parseFloat(s.averageCompletionRate).toFixed(1),
      'Note moyenne':  parseFloat(s.averageGrade).toFixed(1),
    })),
    'statistiques_formations.csv',
  )
}

function exportUsers() {
  exportCSV(
    userStats.value.map((s) => ({
      Utilisateur:      getUserName(s.user),
      Date:             s.date,
      'Leçons':         s.lessonsCompleted,
      'Temps (min)':    s.timeSpentMinutes,
      'Évaluations':    s.evaluationsTaken,
      'Score moyen':    s.averageScore ?? '',
      'Connexions':     s.loginCount,
      'Docs téléch.':   s.documentsDownloaded,
    })),
    'statistiques_utilisateurs.csv',
  )
}
</script>

<template>
  <div class="statistiques-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Statistiques</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton">
      <div class="kpi-skeleton">
        <Skeleton v-for="i in 4" :key="i" height="7rem" border-radius="16px" />
      </div>
      <Skeleton height="280px" border-radius="16px" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <!-- Filtre période -->
      <div class="period-filter">
        <i class="pi pi-calendar filter-icon" />
        <DatePicker
          v-model="dateRange"
          selection-mode="range"
          :manual-input="false"
          placeholder="Filtrer par période"
          date-format="dd/mm/yy"
          show-button-bar
          class="period-picker"
        />
        <Button
          v-if="dateRange[0] || dateRange[1]"
          icon="pi pi-times"
          text
          rounded
          severity="secondary"
          size="small"
          aria-label="Effacer le filtre"
          @click="dateRange = [null, null]"
        />
      </div>

      <Tabs v-model:value="activeTab" class="glass-tabs">
        <TabList>
          <Tab value="formations"  aria-controls="panel-formations">Formations</Tab>
          <Tab value="utilisateurs" aria-controls="panel-utilisateurs">Utilisateurs</Tab>
          <Tab value="satisfaction" aria-controls="panel-satisfaction">Satisfaction</Tab>
        </TabList>

        <TabPanels>

          <!-- ═══ FORMATIONS ═══ -->
          <TabPanel id="panel-formations" value="formations">

            <!-- KPIs -->
            <div class="kpi-grid">
              <Card class="kpi-card">
                <template #title>Inscriptions totales</template>
                <template #content>
                  <span class="stat-value">{{ kpiFormations.totalEnrollments }}</span>
                  <p class="kpi-sub">{{ kpiFormations.activeEnrollments }} actives</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Terminées</template>
                <template #content>
                  <span class="stat-value">{{ kpiFormations.completedEnrollments }}</span>
                  <p class="kpi-sub">{{ kpiFormations.abandonedEnrollments }} abandonnées</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Taux moyen</template>
                <template #content>
                  <span class="stat-value">{{ kpiFormations.avgCompletion }} %</span>
                  <p class="kpi-sub">de complétion</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Note moyenne</template>
                <template #content>
                  <span class="stat-value">{{ kpiFormations.avgGrade }}</span>
                  <p class="kpi-sub">sur 100</p>
                </template>
              </Card>
            </div>

            <!-- Charts row -->
            <div class="charts-row">
              <div class="chart-card">
                <div class="chart-header">
                  <h3 class="chart-title">Taux de complétion dans le temps</h3>
                </div>
                <div class="chart-wrap" style="height: 220px">
                  <Chart
                    v-if="filteredFormationStats.length"
                    type="line"
                    :data="lineChartData"
                    :options="lineChartOptions"
                    style="height: 100%"
                  />
                  <div v-else class="chart-empty"><i class="pi pi-chart-line" /><span>Pas de données</span></div>
                </div>
              </div>

              <div class="chart-card">
                <div class="chart-header">
                  <h3 class="chart-title">Répartition des inscriptions</h3>
                </div>
                <div class="chart-wrap" style="height: 220px">
                  <Chart
                    v-if="kpiFormations.totalEnrollments > 0"
                    type="pie"
                    :data="pieChartData"
                    :options="pieOptions"
                    style="height: 100%"
                  />
                  <div v-else class="chart-empty"><i class="pi pi-chart-pie" /><span>Pas de données</span></div>
                </div>
              </div>
            </div>

            <!-- Bar chart full width -->
            <div class="chart-card chart-card--full">
              <div class="chart-header">
                <h3 class="chart-title">Top formations par inscriptions</h3>
              </div>
              <div class="chart-wrap" style="height: 220px">
                <Chart
                  v-if="filteredFormationStats.length"
                  type="bar"
                  :data="barChartData"
                  :options="chartOptions"
                  style="height: 100%"
                />
                <div v-else class="chart-empty"><i class="pi pi-chart-bar" /><span>Pas de données</span></div>
              </div>
            </div>

            <!-- Table -->
            <div class="table-header">
              <h3 class="chart-title">Détail par formation</h3>
              <Button label="Exporter CSV" icon="pi pi-download" text size="small" @click="exportFormations" />
            </div>

            <DataTable
              :value="filteredFormationStats"
              paginator :rows="10"
              aria-label="Statistiques par formation"
              class="glass-table"
              sort-field="totalEnrollments" :sort-order="-1"
            >
              <template #empty>
                <div class="empty-state"><i class="pi pi-chart-bar" /><p>Aucune statistique disponible.</p></div>
              </template>
              <Column header="Formation" style="min-width: 160px">
                <template #body="{ data }">{{ getFormationName(data.formation) }}</template>
              </Column>
              <Column header="Période" style="min-width: 170px">
                <template #body="{ data }">{{ formatDate(data.periodStart) }} — {{ formatDate(data.periodEnd) }}</template>
              </Column>
              <Column field="totalEnrollments"     header="Total"       style="width: 80px" sortable />
              <Column field="completedEnrollments" header="Terminés"    style="width: 90px" sortable />
              <Column field="abandonedEnrollments" header="Abandons"    style="width: 90px" sortable />
              <Column header="Complétion" style="width: 105px" sortable sort-field="averageCompletionRate">
                <template #body="{ data }">{{ parseFloat(data.averageCompletionRate).toFixed(1) }} %</template>
              </Column>
              <Column header="Note moy." style="width: 100px">
                <template #body="{ data }">{{ parseFloat(data.averageGrade).toFixed(1) }}</template>
              </Column>
            </DataTable>
          </TabPanel>

          <!-- ═══ UTILISATEURS ═══ -->
          <TabPanel id="panel-utilisateurs" value="utilisateurs">

            <div class="kpi-grid">
              <Card class="kpi-card">
                <template #title>Leçons terminées</template>
                <template #content>
                  <span class="stat-value">{{ kpiUsers.totalLessons }}</span>
                  <p class="kpi-sub">au total</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Heures de formation</template>
                <template #content>
                  <span class="stat-value">{{ kpiUsers.totalHours }}</span>
                  <p class="kpi-sub">heures cumulées</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Score moyen</template>
                <template #content>
                  <span class="stat-value">{{ kpiUsers.avgScore }}</span>
                  <p class="kpi-sub">aux évaluations</p>
                </template>
              </Card>
            </div>

            <div class="table-header">
              <h3 class="chart-title">Activité par stagiaire</h3>
              <Button label="Exporter CSV" icon="pi pi-download" text size="small" @click="exportUsers" />
            </div>

            <DataTable
              :value="userStats"
              paginator :rows="10"
              aria-label="Statistiques d'activité"
              class="glass-table"
              sort-field="lessonsCompleted" :sort-order="-1"
            >
              <template #empty>
                <div class="empty-state"><i class="pi pi-users" /><p>Aucune statistique disponible.</p></div>
              </template>
              <Column header="Utilisateur" style="min-width: 160px">
                <template #body="{ data }">{{ getUserName(data.user) }}</template>
              </Column>
              <Column header="Date" style="width: 105px">
                <template #body="{ data }">{{ formatDate(data.date) }}</template>
              </Column>
              <Column field="lessonsCompleted" header="Leçons"  style="width: 80px" sortable />
              <Column header="Temps (h)" style="width: 95px">
                <template #body="{ data }">{{ (data.timeSpentMinutes / 60).toFixed(1) }}</template>
              </Column>
              <Column field="evaluationsTaken" header="Évals."  style="width: 70px" sortable />
              <Column header="Score" style="width: 80px">
                <template #body="{ data }">{{ data.averageScore ?? '—' }}</template>
              </Column>
              <Column field="loginCount"        header="Connexions" style="width: 100px" sortable />
              <Column field="documentsDownloaded" header="Docs" style="width: 60px" sortable />
            </DataTable>
          </TabPanel>

          <!-- ═══ SATISFACTION ═══ -->
          <TabPanel id="panel-satisfaction" value="satisfaction">

            <div class="kpi-grid">
              <Card class="kpi-card">
                <template #title>Note globale</template>
                <template #content>
                  <span class="stat-value">{{ kpiSatisfaction.avgOverall }}</span>
                  <p class="kpi-sub">sur 5</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Recommanderaient</template>
                <template #content>
                  <span class="stat-value">{{ kpiSatisfaction.wouldRecommend }} %</span>
                  <p class="kpi-sub">des répondants</p>
                </template>
              </Card>
              <Card class="kpi-card">
                <template #title>Feedbacks reçus</template>
                <template #content>
                  <span class="stat-value">{{ kpiSatisfaction.count }}</span>
                  <p class="kpi-sub">évaluations</p>
                </template>
              </Card>
            </div>

            <!-- Satisfaction bar chart -->
            <div class="chart-card chart-card--full">
              <div class="chart-header">
                <h3 class="chart-title">Notes moyennes par critère</h3>
              </div>
              <div class="chart-wrap" style="height: 240px">
                <Chart
                  v-if="feedbacks.length"
                  type="bar"
                  :data="satisfactionBarData"
                  :options="satisfactionBarOptions"
                  style="height: 100%"
                />
                <div v-else class="chart-empty"><i class="pi pi-star" /><span>Aucun feedback disponible.</span></div>
              </div>
            </div>

            <!-- Feedbacks table -->
            <DataTable
              :value="feedbacks"
              paginator :rows="10"
              aria-label="Détail des feedbacks"
              class="glass-table"
              sort-field="overallRating" :sort-order="-1"
            >
              <template #empty>
                <div class="empty-state"><i class="pi pi-star" /><p>Aucun feedback disponible.</p></div>
              </template>
              <Column header="Formation" style="min-width: 160px">
                <template #body="{ data }">{{ getFormationName(data.formation) }}</template>
              </Column>
              <Column header="Note globale" style="width: 120px" sortable sort-field="overallRating">
                <template #body="{ data }">
                  <Tag
                    v-if="data.overallRating !== null"
                    :value="`${data.overallRating} / 5`"
                    :severity="data.overallRating >= 4 ? 'success' : data.overallRating >= 3 ? 'warn' : 'danger'"
                  />
                  <span v-else class="muted">—</span>
                </template>
              </Column>
              <Column header="Contenu" style="width: 85px">
                <template #body="{ data }">{{ data.contentQuality ?? '—' }}</template>
              </Column>
              <Column header="Formateur" style="width: 95px">
                <template #body="{ data }">{{ data.formatorQuality ?? '—' }}</template>
              </Column>
              <Column header="Organisation" style="width: 110px">
                <template #body="{ data }">{{ data.organizationQuality ?? '—' }}</template>
              </Column>
              <Column header="Recommande" style="width: 110px">
                <template #body="{ data }">
                  <Tag v-if="data.wouldRecommend === true"  value="Oui" severity="success" />
                  <Tag v-else-if="data.wouldRecommend === false" value="Non" severity="danger" />
                  <span v-else class="muted">—</span>
                </template>
              </Column>
              <Column header="Date" style="width: 105px">
                <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
              </Column>
            </DataTable>
          </TabPanel>

        </TabPanels>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.statistiques-page { display: flex; flex-direction: column; gap: 1.25rem; }
.list-skeleton     { display: flex; flex-direction: column; gap: 1rem; }
.kpi-skeleton      { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }

/* Period filter */
.period-filter {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.filter-icon { color: #8b5cf6; }
.period-picker { width: 240px; }

/* Tabs glass */
.glass-tabs { background: transparent; }

:deep(.p-tablist) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px) !important;
  border-radius: 14px 14px 0 0 !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
  padding: 0 0.75rem !important;
}

:deep(.p-tab) {
  color: #7c6fa0 !important; font-weight: 500 !important;
  border-bottom: 2px solid transparent !important;
  padding: 0.875rem 1rem !important; transition: color 0.15s, border-color 0.15s !important;
}

:deep(.p-tab[aria-selected="true"]), :deep(.p-tab.p-tab-active) {
  color: #6d28d9 !important; border-bottom-color: #8b5cf6 !important; font-weight: 600 !important;
}

:deep(.p-tabpanels) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px) !important;
  border-radius: 0 0 14px 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-top: none !important;
  padding: 1.5rem !important;
}

/* KPI grid */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.kpi-card { text-align: center; }
.kpi-sub  { font-size: 0.72rem; color: #7c6fa0; margin: 0.2rem 0 0; }

/* Charts */
.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.chart-card {
  background: rgba(255, 255, 255, 0.50);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 16px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.chart-card--full { grid-column: 1 / -1; }

.chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.chart-title  { font-size: 0.875rem; font-weight: 700; color: #4c1d95; margin: 0; }

.chart-wrap   { position: relative; }

.chart-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; gap: 0.5rem; color: #7c6fa0; font-size: 0.875rem;
}
.chart-empty .pi { font-size: 2rem; opacity: 0.3; }

/* Table header actions */
.table-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 0.75rem;
}

/* Table glass */
.glass-table { background: transparent !important; }

:deep(.glass-table .p-datatable-header-cell) {
  background: rgba(237, 233, 254, 0.5) !important; color: #5b21b6 !important;
  font-size: 0.72rem !important; font-weight: 700 !important; text-transform: uppercase !important;
  letter-spacing: 0.05em !important; border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
}
:deep(.glass-table .p-datatable-tbody > tr) {
  background: transparent !important; border-bottom: 1px solid rgba(196, 181, 253, 0.1) !important;
}
:deep(.glass-table .p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.07) !important;
}

/* Error / empty */
.dash-error {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4); border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.875rem;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 2.5rem 1rem; color: #7c6fa0;
}
.empty-state .pi { font-size: 1.75rem; opacity: 0.3; }
.empty-state p   { margin: 0; font-size: 0.875rem; }

.muted { color: #9ca3af; font-style: italic; }
</style>
