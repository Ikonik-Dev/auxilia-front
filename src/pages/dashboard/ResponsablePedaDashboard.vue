<script setup lang="ts">
import { onMounted } from 'vue'
import { apiDashboardresponsablePedaGet } from '@/api'
import { useDashboard } from '@/composables/useDashboard'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Rating from 'primevue/rating'
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

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

const router = useRouter()
const { data, loading, error, isRateLimited, rateLimitSeconds, load, refetch } =
  useDashboard<ResponsableData>(apiDashboardresponsablePedaGet)

onMounted(async () => {
  document.title = 'Tableau de bord — Auxilium'
  await load()
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
  <div :aria-busy="loading">
    <div class="page-header">
      <h1>Tableau de bord</h1>
      <Tag value="Responsable pédagogique" severity="warn" />
    </div>

    <!-- Rate limit 429 -->
    <div v-if="isRateLimited" role="alert" aria-live="polite" class="dash-warn">
      <i class="pi pi-clock" />
      {{ error }} ({{ rateLimitSeconds }}s)
    </div>

    <!-- Erreur générale -->
    <div v-else-if="error" role="alert" aria-live="assertive" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
      <Button
        label="Réessayer"
        icon="pi pi-refresh"
        size="small"
        severity="danger"
        text
        class="ml-2"
        @click="refetch"
      />
    </div>

    <!-- KPI cards -->
    <div class="stats-grid">
      <template v-if="loading">
        <Card v-for="n in 5" :key="n" class="kpi-card">
          <template #content>
            <Skeleton width="40%" height="2rem" class="mb-2" />
            <Skeleton width="60%" height="0.8rem" />
          </template>
        </Card>
      </template>

      <template v-else-if="data">
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner" :aria-label="`Inscriptions ce mois : ${data.kpis.totalEnrollments}`">
              <i class="pi pi-users kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.kpis.totalEnrollments ?? '—' }}</span>
              <span class="stat-sub">Inscriptions ce mois</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner" :aria-label="`Inscriptions actives : ${data.kpis.activeEnrollments}`">
              <i class="pi pi-spinner kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.kpis.activeEnrollments ?? '—' }}</span>
              <span class="stat-sub">Actives</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner" :aria-label="`Inscriptions complétées : ${data.kpis.completedEnrollments}`">
              <i class="pi pi-verified kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ data.kpis.completedEnrollments ?? '—' }}</span>
              <span class="stat-sub">Complétées</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner" :aria-label="`Taux de complétion moyen : ${fmt(data.kpis.avgCompletionRate, ' %')}`">
              <i class="pi pi-chart-line kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ fmt(data.kpis.avgCompletionRate, ' %') }}</span>
              <span class="stat-sub">Taux de complétion</span>
            </div>
          </template>
        </Card>
        <Card class="kpi-card">
          <template #content>
            <div class="kpi-inner" :aria-label="`Moyenne générale : ${fmt(data.kpis.avgGrade)}`">
              <i class="pi pi-star kpi-icon" aria-hidden="true" />
              <span class="stat-value">{{ fmt(data.kpis.avgGrade) }}</span>
              <span class="stat-sub">Moyenne générale</span>
            </div>
          </template>
        </Card>
      </template>
    </div>

    <!-- Inscriptions en attente -->
    <div class="section-block">
      <div class="section-header-row">
        <h3 class="section-title">
          Inscriptions en attente de validation
          <span v-if="!loading && (data?.pendingEnrollments?.length ?? 0) > 0" class="badge-count">
            {{ data!.pendingEnrollments.length }}
          </span>
        </h3>
        <Button
          v-if="!loading && (data?.pendingEnrollments?.length ?? 0) > 0"
          label="Voir toutes les inscriptions"
          icon="pi pi-arrow-right"
          icon-pos="right"
          size="small"
          severity="secondary"
          text
          @click="router.push('/inscriptions')"
        />
      </div>

      <div v-if="loading" class="list-skeleton">
        <Skeleton v-for="n in 3" :key="n" height="3.5rem" class="mb-2" border-radius="12px" />
      </div>

      <div v-else-if="data?.pendingEnrollments?.length" class="pending-list">
        <div v-for="enrollment in data.pendingEnrollments" :key="enrollment.id" class="pending-item">
          <div class="pending-avatar" aria-hidden="true">
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
            :aria-label="`Note : ${fb.overallRating ?? 0} sur 5`"
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

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
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

.section-header-row .section-title {
  margin-bottom: 0;
}

.badge-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  background: #b91c1c;
  color: #fff;
  border-radius: 11px;
  font-size: 0.7rem;
  font-weight: 700;
}

.list-skeleton { display: flex; flex-direction: column; }

/* Pending items */
.pending-list,
.feedback-list {
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
  color: #675c9c;
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
  color: #6b7280;
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
  color: #6b7280;
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

/* Error / warn banners */
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

.dash-warn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 243, 199, 0.5);
  border: 1px solid rgba(253, 230, 138, 0.6);
  color: #92400e;
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

.ml-2 {
  margin-left: 0.5rem;
}
</style>
