<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiDashboardresponsablePedaGet } from '@/api'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Rating from 'primevue/rating'

interface Kpis {
  totalEnrollments: number
  activeEnrollments: number
  completedEnrollments: number
  avgCompletionRate: number | null
  avgGrade: number | null
}

interface PendingEnrollment {
  id: number
  userName: string
  formationTitle: string
  enrollmentDate: string
}

interface RecentFeedback {
  id: number
  formationTitle: string
  overallRating: number | null
  comment: string | null
  createdAt: string
}

interface ResponsableData {
  kpis: Kpis
  pendingEnrollments: PendingEnrollment[]
  recentFeedbacks: RecentFeedback[]
}

const data = ref<ResponsableData | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  const { data: raw, error: apiError } = await apiDashboardresponsablePedaGet()
  if (apiError) {
    error.value = 'Impossible de charger le tableau de bord.'
  } else {
    data.value = raw as unknown as ResponsableData
  }
  loading.value = false
})

function fmt(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined) return '—'
  return `${parseFloat(String(val)).toFixed(1)}${suffix}`
}

function fmtDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' })
}
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Tableau de bord</h2>
      <Tag value="Responsable pédagogique" severity="warn" />
    </div>

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
            <span class="stat-value">{{ data.kpis.totalEnrollments ?? '—' }}</span>
            <p class="stat-sub">ce mois</p>
          </template>
        </Card>
        <Card>
          <template #title>Actives</template>
          <template #content>
            <span class="stat-value">{{ data.kpis.activeEnrollments ?? '—' }}</span>
            <p class="stat-sub">en cours</p>
          </template>
        </Card>
        <Card>
          <template #title>Complétées</template>
          <template #content>
            <span class="stat-value">{{ data.kpis.completedEnrollments ?? '—' }}</span>
            <p class="stat-sub">certifiées</p>
          </template>
        </Card>
        <Card>
          <template #title>Taux moyen</template>
          <template #content>
            <span class="stat-value">{{ fmt(data.kpis.avgCompletionRate, ' %') }}</span>
            <p class="stat-sub">complétion</p>
          </template>
        </Card>
      </template>
    </div>

    <!-- Inscriptions en attente -->
    <div class="section-block">
      <h3 class="section-title">
        Inscriptions en attente de validation
        <span v-if="!loading && (data?.pendingEnrollments?.length ?? 0) > 0" class="badge-count">
          {{ data!.pendingEnrollments.length }}
        </span>
      </h3>

      <div v-if="loading" class="list-skeleton">
        <Skeleton v-for="n in 3" :key="n" height="3.5rem" class="mb-2" border-radius="12px" />
      </div>

      <div v-else-if="data?.pendingEnrollments?.length" class="pending-list">
        <div v-for="enrollment in data.pendingEnrollments" :key="enrollment.id" class="pending-item">
          <div class="pending-avatar">
            <i class="pi pi-user" />
          </div>
          <div class="pending-info">
            <span class="pending-name">{{ enrollment.userName }}</span>
            <span class="pending-formation">{{ enrollment.formationTitle }}</span>
          </div>
          <div class="pending-right">
            <span class="pending-date">{{ fmtDate(enrollment.enrollmentDate) }}</span>
            <Tag value="En attente" severity="warn" />
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-check-circle" />
        <p>Aucune inscription en attente — tout est à jour !</p>
      </div>
    </div>

    <!-- Feedbacks récents -->
    <div class="section-block">
      <h3 class="section-title">Feedbacks récents</h3>

      <div v-if="loading" class="list-skeleton">
        <Skeleton v-for="n in 3" :key="n" height="4.5rem" class="mb-2" border-radius="12px" />
      </div>

      <div v-else-if="data?.recentFeedbacks?.length" class="feedback-list">
        <div v-for="fb in data.recentFeedbacks" :key="fb.id" class="feedback-item">
          <div class="feedback-top">
            <span class="feedback-formation">{{ fb.formationTitle }}</span>
            <span class="feedback-date">{{ fmtDate(fb.createdAt) }}</span>
          </div>
          <Rating
            :model-value="fb.overallRating ?? 0"
            :stars="5"
            readonly
            :cancel="false"
            class="feedback-rating"
          />
          <p v-if="fb.comment" class="feedback-comment">{{ fb.comment }}</p>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <i class="pi pi-star" />
        <p>Aucun feedback disponible pour le moment.</p>
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

.list-skeleton { display: flex; flex-direction: column; }

/* Pending items */
.pending-list, .feedback-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pending-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.875rem 1rem;
  background: rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 14px;
  transition: background 0.15s;
}

.pending-item:hover {
  background: rgba(255, 255, 255, 0.65);
}

.pending-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  color: #4c1d95;
  flex-shrink: 0;
}

.pending-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pending-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
}

.pending-formation {
  font-size: 0.75rem;
  color: #7c6fa0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pending-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.pending-date {
  font-size: 0.7rem;
  color: #9ca3af;
}

/* Feedback items */
.feedback-item {
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 14px;
}

.feedback-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.feedback-formation {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
}

.feedback-date {
  font-size: 0.7rem;
  color: #9ca3af;
}

.feedback-rating {
  margin-bottom: 0.375rem;
}

:deep(.p-rating-icon) {
  font-size: 0.9rem !important;
  color: #f59e0b !important;
}

.feedback-comment {
  font-size: 0.8125rem;
  color: #4b5563;
  margin: 0.25rem 0 0;
  font-style: italic;
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
