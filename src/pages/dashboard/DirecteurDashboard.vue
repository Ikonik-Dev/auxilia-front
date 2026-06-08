<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { apiDashboarddirecteurGet } from '@/api'
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
} from 'chart.js'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

interface GlobalKpis {
  totalFormations: number
  totalUsers: number
  totalEnrollments: number
  activeEnrollments: number
  completedEnrollments: number
  avgCompletionRate: number | null
  avgGrade: number | null
}

interface TopFormation {
  id: number
  title: string
  completedEnrollments: number
  avgCompletionRate: string | number | null
}

interface PeriodTrend {
  periodStart: string
  periodEnd: string
  totalEnrollments: number
  completedEnrollments: number
  avgCompletionRate: string | number | null
}

interface DirecteurData {
  globalKpis: GlobalKpis
  topFormations: TopFormation[]
  periodTrends: PeriodTrend[]
}

const data = ref<DirecteurData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const chartCanvas = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

onMounted(async () => {
  document.title = 'Tableau de bord — Auxilium'
  const { data: raw, error: apiError } = await apiDashboarddirecteurGet()
  if (apiError) {
    error.value = 'Impossible de charger le tableau de bord.'
  } else {
    data.value = raw as unknown as DirecteurData
  }
  loading.value = false
  await nextTick()
  buildChart()
})

onUnmounted(() => {
  chartInstance?.destroy()
})

function buildChart() {
  if (!chartCanvas.value || !data.value?.periodTrends?.length) return

  chartInstance?.destroy()

  const trends = data.value.periodTrends
  const labels = trends.map((t) =>
    new Date(t.periodStart).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
  )
  const values = trends.map((t) =>
    t.avgCompletionRate !== null && t.avgCompletionRate !== undefined
      ? parseFloat(String(t.avgCompletionRate))
      : null,
  )

  chartInstance = new Chart(chartCanvas.value, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Taux de complétion',
          data: values,
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.08)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#8b5cf6',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30, 27, 75, 0.9)',
          padding: 10,
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y?.toFixed(1) ?? '—'} %`,
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: {
            callback: (v) => `${v} %`,
            color: '#675c9c',
            font: { size: 11 },
          },
          grid: { color: 'rgba(196, 181, 253, 0.2)' },
        },
        x: {
          ticks: { color: '#675c9c', font: { size: 11 } },
          grid: { display: false },
        },
      },
    },
  })
}

function fmt(val: string | number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(String(val))
  return isNaN(n) ? '—' : `${n.toFixed(1)}${suffix}`
}
</script>

<template>
  <div :aria-busy="loading">
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <Tag value="Directeur" severity="info" />
    </div>

    <div v-if="error" role="alert" aria-live="assertive" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- KPI cards -->
    <div class="stats-grid">
      <template v-if="loading">
        <Card v-for="n in 4" :key="n" class="kpi-card">
          <template #content>
            <Skeleton width="40%" height="2rem" class="mb-2" />
            <Skeleton width="60%" height="0.8rem" />
          </template>
        </Card>
      </template>

      <template v-else-if="data">
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner">
              <i class="pi pi-book kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.globalKpis.totalFormations ?? '—' }}</span>
              <span class="stat-sub">Formations</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner">
              <i class="pi pi-users kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.globalKpis.totalUsers ?? '—' }}</span>
              <span class="stat-sub">Utilisateurs</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner">
              <i class="pi pi-spinner kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.globalKpis.activeEnrollments ?? '—' }}</span>
              <span class="stat-sub">Inscriptions actives</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner">
              <i class="pi pi-chart-line kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ fmt(data.globalKpis.avgCompletionRate, ' %') }}</span>
              <span class="stat-sub">Taux de complétion</span>
            </div>
          </template>
        </Card>
      </template>
    </div>

    <!-- Trend chart -->
    <div class="section-block">
      <h3 class="section-title">Évolution du taux de complétion</h3>

      <div v-if="loading" class="chart-skeleton">
        <Skeleton height="100%" border-radius="16px" />
      </div>

      <div v-else-if="data?.periodTrends?.length" class="chart-wrap">
        <canvas ref="chartCanvas" aria-label="Graphique linéaire du taux de complétion par période" role="img" />
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-chart-line" />
        <p>Aucune donnée de tendance disponible.</p>
      </div>
    </div>

    <!-- Top formations table -->
    <div class="section-block">
      <h3 class="section-title">Top 10 formations</h3>

      <div v-if="loading" class="table-skeleton">
        <Skeleton v-for="n in 5" :key="n" height="2.5rem" class="mb-2" />
      </div>

      <DataTable
        v-else-if="data?.topFormations?.length"
        :value="data.topFormations"
        class="glass-table"
        :rows="10"
        striped-rows
      >
        <Column field="title" header="Formation" />
        <Column field="completedEnrollments" header="Complétées" style="width: 130px; text-align: right" />
        <Column header="Taux moyen" style="width: 130px">
          <template #body="{ data: row }">
            {{ fmt(row.avgCompletionRate, ' %') }}
          </template>
        </Column>
      </DataTable>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-chart-bar" />
        <p>Aucune statistique disponible pour le moment.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* KPI grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.kpi-card :deep(.p-card-body) {
  padding: 1rem !important;
}

.kpi-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  text-align: center;
}

.kpi-icon {
  font-size: 1.5rem;
  background: linear-gradient(135deg, #a78bfa, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-sub {
  font-size: 0.75rem;
  color: #675c9c;
  margin: 0.25rem 0 0;
}

/* Section layout */
.section-block {
  margin-top: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #4c1d95;
  margin: 0 0 1rem;
  letter-spacing: -0.01em;
}

/* Chart */
.chart-wrap {
  position: relative;
  height: 260px;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 16px;
  padding: 1.25rem;
}

.chart-skeleton {
  height: 260px;
  border-radius: 16px;
  overflow: hidden;
}

/* Table */
.table-skeleton {
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
  border-bottom: 1px solid rgba(196, 181, 253, 0.15) !important;
  transition: background 0.15s;
}

:deep(.p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.08) !important;
}

/* Error */
.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

/* Empty state */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #675c9c;
  background: rgba(255, 255, 255, 0.35);
  border-radius: 16px;
  border: 1px dashed rgba(196, 181, 253, 0.5);
}

.empty-state .pi {
  font-size: 2rem;
  opacity: 0.4;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}
</style>
