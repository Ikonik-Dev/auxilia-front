<script setup lang="ts">
import { computed, onMounted } from 'vue'
import Tag from 'primevue/tag'
import ProgressBar from 'primevue/progressbar'
import Skeleton from 'primevue/skeleton'
import { useParcours } from '@/composables/useParcours'

const { enrollments, loading, error, fetchParcours } = useParcours()

onMounted(() => {
  document.title = 'Mon Parcours — Auxilium'
  fetchParcours()
})

// --- Helpers ---
const STATUS_LABELS: Record<string, string> = {
  enrolled: 'Inscrit',
  in_progress: 'En cours',
  completed: 'Terminé',
  abandoned: 'Abandonné',
  cancelled: 'Annulé',
  pending: 'En attente',
}

const STATUS_SEVERITY: Record<
  string,
  'success' | 'info' | 'warn' | 'danger' | 'secondary'
> = {
  enrolled: 'info',
  in_progress: 'warn',
  completed: 'success',
  abandoned: 'danger',
  cancelled: 'secondary',
  pending: 'secondary',
}

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s
}
function statusSeverity(s: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  return STATUS_SEVERITY[s] ?? 'secondary'
}
function progressValue(raw: string): number {
  return Math.round(parseFloat(raw))
}
function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

const inProgress = computed(() => enrollments.value.filter((e) => e.status === 'in_progress'))
const others = computed(() => enrollments.value.filter((e) => e.status !== 'in_progress'))
</script>

<template>
  <div class="parcours-page" :aria-busy="loading ? 'true' : undefined">
    <div class="page-header">
      <h1>Mon Parcours</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement de votre parcours en cours">
      <Skeleton v-for="i in 3" :key="i" height="7rem" class="skeleton-card" />
    </div>

    <!-- Vide -->
    <div v-else-if="enrollments.length === 0" class="empty-state">
      <i class="pi pi-map empty-icon" aria-hidden="true" />
      <p>Vous n'êtes inscrit à aucune formation pour l'instant.</p>
    </div>

    <!-- Contenu -->
    <template v-else>
      <!-- Formations en cours -->
      <section v-if="inProgress.length > 0" aria-labelledby="section-in-progress">
        <h2 id="section-in-progress" class="section-title">En cours</h2>
        <div class="cards-grid">
          <article
            v-for="enrollment in inProgress"
            :key="enrollment.id"
            class="enrollment-card enrollment-card--active"
          >
            <div class="card-header">
              <span class="session-name">{{ enrollment.session.name }}</span>
              <Tag
                :value="statusLabel(enrollment.status)"
                :severity="statusSeverity(enrollment.status)"
              />
            </div>
            <div class="card-progress">
              <div class="progress-label">
                <span>Progression</span>
                <span>{{ progressValue(enrollment.progressPercentage) }} %</span>
              </div>
              <ProgressBar
                :value="progressValue(enrollment.progressPercentage)"
                :show-value="false"
                aria-label="Progression de la formation"
              />
            </div>
            <div class="card-meta">
              <span>Début : {{ formatDate(enrollment.startDate) }}</span>
              <span v-if="enrollment.certificateIssued" class="cert-badge">
                <i class="pi pi-verified" aria-hidden="true" />
                Certificat délivré
              </span>
            </div>
          </article>
        </div>
      </section>

      <!-- Autres formations -->
      <section v-if="others.length > 0" aria-labelledby="section-others">
        <h2 id="section-others" class="section-title">Autres formations</h2>
        <div class="cards-grid">
          <article
            v-for="enrollment in others"
            :key="enrollment.id"
            class="enrollment-card"
          >
            <div class="card-header">
              <span class="session-name">{{ enrollment.session.name }}</span>
              <Tag
                :value="statusLabel(enrollment.status)"
                :severity="statusSeverity(enrollment.status)"
              />
            </div>
            <div class="card-progress">
              <div class="progress-label">
                <span>Progression</span>
                <span>{{ progressValue(enrollment.progressPercentage) }} %</span>
              </div>
              <ProgressBar
                :value="progressValue(enrollment.progressPercentage)"
                :show-value="false"
                aria-label="Progression de la formation"
              />
            </div>
            <div class="card-meta">
              <span>Inscription : {{ formatDate(enrollment.enrollmentDate) }}</span>
              <span v-if="enrollment.completionDate">
                Terminé le {{ formatDate(enrollment.completionDate) }}
              </span>
            </div>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.parcours-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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

.skeleton-card {
  border-radius: var(--p-border-radius-lg);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem;
  color: var(--p-text-muted-color);
  text-align: center;
}

.empty-icon {
  font-size: 2.5rem;
}

.section-title {
  margin: 0 0 0.75rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.enrollment-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-lg);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.enrollment-card--active {
  border-color: var(--p-primary-color);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.session-name {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.3;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.35rem;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.cert-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--p-green-600);
  font-weight: 500;
}
</style>
