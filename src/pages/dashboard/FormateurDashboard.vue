<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { apiDashboardformateurGet } from '@/api'
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'

interface MySession {
  id: number
  name: string
  formationTitle: string
  enrollmentCount: number
}

interface RecentAttendance {
  id: number
  userName: string
  scheduleDate: string
  status: string
}

interface PendingEnrollment {
  id: number
  userName: string
  formationTitle: string
  status: string
  progress: string | number
}

interface FormateurData {
  mySessions: MySession[]
  recentAttendances: RecentAttendance[]
  pendingEnrollments: PendingEnrollment[]
}

const data = ref<FormateurData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const { data: raw, error: apiError } = await apiDashboardformateurGet()
  if (apiError) {
    error.value = 'Impossible de charger le tableau de bord.'
  } else {
    data.value = raw as unknown as FormateurData
  }
  loading.value = false
})

const pendingCount = computed(() => data.value?.pendingEnrollments?.length ?? 0)

function attendanceTag(status: string): 'success' | 'danger' | 'warn' | 'secondary' {
  if (status === 'present') return 'success'
  if (status === 'absent') return 'danger'
  if (status === 'excused') return 'warn'
  return 'secondary'
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Tableau de bord</h2>
      <Tag value="Formateur" severity="success" />
    </div>

    <div v-if="error" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- KPI cards -->
    <div class="stats-grid">
      <template v-if="loading">
        <Card v-for="n in 3" :key="n">
          <template #title><Skeleton width="60%" height="0.8rem" /></template>
          <template #content><Skeleton width="40%" height="2rem" class="mt-2" /></template>
        </Card>
      </template>

      <template v-else-if="data">
        <Card>
          <template #title>Mes sessions</template>
          <template #content>
            <span class="stat-value">{{ data.mySessions?.length ?? 0 }}</span>
            <p class="stat-sub">sessions assignées</p>
          </template>
        </Card>
        <Card>
          <template #title>Assiduités récentes</template>
          <template #content>
            <span class="stat-value">{{ data.recentAttendances?.length ?? 0 }}</span>
            <p class="stat-sub">dernières 20</p>
          </template>
        </Card>
        <Card>
          <template #title>En attente</template>
          <template #content>
            <span class="stat-value" :class="{ 'stat-value--warn': pendingCount > 0 }">
              {{ pendingCount }}
            </span>
            <p class="stat-sub">inscriptions à valider</p>
          </template>
        </Card>
      </template>
    </div>

    <!-- Mes sessions -->
    <div class="section-block">
      <h3 class="section-title">Mes sessions</h3>

      <div v-if="loading" class="table-skeleton">
        <Skeleton v-for="n in 4" :key="n" height="2.5rem" class="mb-2" />
      </div>

      <DataTable
        v-else-if="data?.mySessions?.length"
        :value="data.mySessions"
        class="glass-table"
        striped-rows
      >
        <Column field="name" header="Session" />
        <Column field="formationTitle" header="Formation" />
        <Column field="enrollmentCount" header="Inscrits" style="width: 100px; text-align: right" />
      </DataTable>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-calendar" />
        <p>Aucune session assignée pour le moment.</p>
      </div>
    </div>

    <!-- Inscriptions en attente -->
    <div v-if="!loading && pendingCount > 0" class="section-block">
      <h3 class="section-title">
        Inscriptions en attente
        <span class="badge-count">{{ pendingCount }}</span>
      </h3>

      <div class="pending-list">
        <div v-for="enrollment in data!.pendingEnrollments" :key="enrollment.id" class="pending-item">
          <div class="pending-info">
            <span class="pending-name">{{ enrollment.userName }}</span>
            <span class="pending-formation">{{ enrollment.formationTitle }}</span>
          </div>
          <Tag value="En attente" severity="warn" />
        </div>
      </div>
    </div>

    <!-- Assiduités récentes -->
    <div v-if="!loading && (data?.recentAttendances?.length ?? 0) > 0" class="section-block">
      <h3 class="section-title">Assiduités récentes</h3>

      <DataTable
        :value="data!.recentAttendances"
        class="glass-table"
        :rows="10"
        striped-rows
      >
        <Column field="userName" header="Stagiaire" />
        <Column header="Date" style="width: 160px">
          <template #body="{ data: row }">{{ fmtDate(row.scheduleDate) }}</template>
        </Column>
        <Column header="Statut" style="width: 120px">
          <template #body="{ data: row }">
            <Tag :value="row.status" :severity="attendanceTag(row.status)" />
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>

<style scoped>
.stat-sub {
  font-size: 0.75rem;
  color: #7c6fa0;
  margin: 0.25rem 0 0;
}

.stat-value--warn {
  background: linear-gradient(135deg, #f59e0b, #ef4444) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

.section-block {
  margin-top: 2rem;
}

.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: #4c1d95;
  margin: 0 0 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: linear-gradient(135deg, #f59e0b, #ef4444);
  color: #fff;
  border-radius: 11px;
  font-size: 0.7rem;
  font-weight: 700;
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

.pending-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pending-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  transition: background 0.15s;
}

.pending-item:hover {
  background: rgba(255, 255, 255, 0.6);
}

.pending-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pending-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
}

.pending-formation {
  font-size: 0.75rem;
  color: #7c6fa0;
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
