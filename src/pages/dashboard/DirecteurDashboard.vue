<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiDashboarddirecteurGet } from '@/api'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'

interface GlobalKpis {
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

interface DirecteurData {
  globalKpis: GlobalKpis
  topFormations: TopFormation[]
}

const data = ref<DirecteurData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const { data: raw, error: apiError } = await apiDashboarddirecteurGet()
  if (apiError) {
    error.value = 'Impossible de charger le tableau de bord.'
  } else {
    data.value = raw as unknown as DirecteurData
  }
  loading.value = false
})

function fmt(val: string | number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(String(val))
  return isNaN(n) ? '—' : `${n.toFixed(1)}${suffix}`
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Tableau de bord</h2>
      <Tag value="Directeur" severity="info" />
    </div>

    <!-- Error -->
    <div v-if="error" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- KPI cards -->
    <div class="stats-grid">
      <template v-if="loading">
        <Card v-for="n in 4" :key="n">
          <template #title><Skeleton width="60%" height="0.8rem" /></template>
          <template #content><Skeleton width="40%" height="2rem" class="mt-2" /></template>
        </Card>
      </template>

      <template v-else-if="data">
        <Card>
          <template #title>Inscriptions totales</template>
          <template #content>
            <span class="stat-value">{{ data.globalKpis.totalEnrollments ?? '—' }}</span>
            <p class="stat-sub">12 derniers mois</p>
          </template>
        </Card>
        <Card>
          <template #title>Inscriptions actives</template>
          <template #content>
            <span class="stat-value">{{ data.globalKpis.activeEnrollments ?? '—' }}</span>
            <p class="stat-sub">en cours</p>
          </template>
        </Card>
        <Card>
          <template #title>Complétées</template>
          <template #content>
            <span class="stat-value">{{ data.globalKpis.completedEnrollments ?? '—' }}</span>
            <p class="stat-sub">certifiées</p>
          </template>
        </Card>
        <Card>
          <template #title>Taux de complétion</template>
          <template #content>
            <span class="stat-value">{{ fmt(data.globalKpis.avgCompletionRate, ' %') }}</span>
            <p class="stat-sub">moyenne globale</p>
          </template>
        </Card>
      </template>
    </div>

    <!-- Top formations table -->
    <div class="section-block">
      <h3 class="section-title">Top formations</h3>

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
        <Column field="completedEnrollments" header="Complétées" style="width: 140px; text-align: right" />
        <Column header="Taux moyen" style="width: 140px">
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
.stat-sub {
  font-size: 0.75rem;
  color: #7c6fa0;
  margin: 0.25rem 0 0;
}

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

.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #7c6fa0;
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
