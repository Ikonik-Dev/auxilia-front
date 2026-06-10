<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useParcours } from '@/composables/useParcours'
import type { LessonRow } from '@/composables/useParcours'
import MilestonesList from '@/components/parcours/MilestonesList.vue'
import type { EnrollmentEnrollmentRead } from '@/api'
import ProgressBar from 'primevue/progressbar'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const {
  enrollments,
  activeEnrollments,
  selectedEnrollment,
  modules,
  milestones,
  loading,
  loadingDetail,
  error,
  fetchParcours,
  selectEnrollment,
  updateLessonStatus,
} = useParcours()

onMounted(() => {
  document.title = 'Mon Parcours — Auxilium'
  fetchParcours()
})

// ── Sélection enrollment (si plusieurs actifs) ──
const enrollmentOptions = ref<{ label: string; value: EnrollmentEnrollmentRead }[]>([])

function buildOptions() {
  enrollmentOptions.value = activeEnrollments.value.map((e) => ({
    label: e.session.name,
    value: e,
  }))
}

// Rebuild options quand les enrollments chargent
watch(enrollments, buildOptions)

// ── Accordion des modules ──
const openModules = ref(new Set<number>())

function toggleModule(id: number) {
  if (openModules.value.has(id)) openModules.value.delete(id)
  else openModules.value.add(id)
}

function isOpen(id: number): boolean {
  return openModules.value.has(id)
}

// Ouvrir automatiquement le premier module
watch(modules, (mods) => {
  if (mods.length > 0 && openModules.value.size === 0) {
    openModules.value = new Set([mods[0]!.id])
  }
})

// ── Statut leçon ──
const LESSON_STATUS_CONFIG = {
  not_started: { icon: 'pi-circle',       label: 'À faire',     next: 'in_progress' as const },
  in_progress: { icon: 'pi-circle-fill',  label: 'En cours',    next: 'completed'   as const },
  completed:   { icon: 'pi-check-circle', label: 'Terminé',     next: 'not_started' as const },
}

const LESSON_TYPE_LABELS: Record<string, string> = {
  video: 'Vidéo', text: 'Texte', quiz: 'Quiz', exercise: 'Exercice', document: 'Document',
}

function lessonTypeLabel(t: string | null): string {
  return t ? (LESSON_TYPE_LABELS[t] ?? t) : ''
}

const updatingLesson = ref<number | null>(null)

// ── Dialog lecteur de leçon ──
const activeLesson    = ref<LessonRow | null>(null)
const lessonDialogVisible = ref(false)

function openLesson(lesson: LessonRow) {
  activeLesson.value = lesson
  lessonDialogVisible.value = true
}

async function setLessonStatus(lesson: LessonRow, status: 'not_started' | 'in_progress' | 'completed') {
  if (updatingLesson.value === lesson.id) return
  updatingLesson.value = lesson.id
  try {
    await updateLessonStatus(lesson, status)
    // Sync activeLesson so Dialog buttons update
    if (activeLesson.value?.id === lesson.id) {
      activeLesson.value = { ...activeLesson.value, status }
    }
    if (status === 'completed') {
      toast.add({ severity: 'success', summary: 'Leçon terminée !', detail: lesson.title, life: 2500 })
    }
  } catch {
    toast.add({ severity: 'error', summary: 'Erreur', detail: 'Impossible de mettre à jour la leçon.', life: 3000 })
  } finally {
    updatingLesson.value = null
  }
}

// ── Helpers ──
function progressValue(raw: string): number {
  const n = parseFloat(raw)
  return isNaN(n) ? 0 : Math.round(n)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { dateStyle: 'medium' })
}

const STATUS_SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  active: 'success', in_progress: 'warn', completed: 'info', pending: 'secondary', abandoned: 'danger',
}
const STATUS_LABELS: Record<string, string> = {
  active: 'Actif', in_progress: 'En cours', completed: 'Terminé', pending: 'En attente', abandoned: 'Abandonné',
}
</script>

<template>
  <div class="parcours-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>Mon Parcours</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- Chargement global -->
    <div v-else-if="loading" class="list-skeleton">
      <Skeleton v-for="i in 3" :key="i" height="7rem" border-radius="18px" />
    </div>

    <!-- Vide -->
    <div v-else-if="enrollments.length === 0" class="empty-hero">
      <i class="pi pi-map empty-icon" aria-hidden="true" />
      <h2>Aucune formation</h2>
      <p>Vous n'êtes inscrit à aucune formation pour l'instant.</p>
    </div>

    <template v-else>
      <!-- Sélecteur enrollment (si plusieurs) -->
      <div v-if="activeEnrollments.length > 1" class="enrollment-selector">
        <label for="enr-select" class="selector-label">Formation</label>
        <Select
          id="enr-select"
          :model-value="selectedEnrollment"
          :options="enrollmentOptions"
          option-label="label"
          option-value="value"
          placeholder="Choisir une formation active…"
          fluid
          @change="(e) => selectEnrollment(e.value)"
        />
      </div>

      <!-- Carte enrollment sélectionné -->
      <div v-if="selectedEnrollment" class="enrollment-hero">
        <div class="hero-left">
          <div class="hero-session">{{ selectedEnrollment.session.name }}</div>
          <Tag
            :value="STATUS_LABELS[selectedEnrollment.status] ?? selectedEnrollment.status"
            :severity="STATUS_SEVERITY[selectedEnrollment.status] ?? 'secondary'"
          />
        </div>
        <div class="hero-right">
          <div class="hero-dates">
            <span>Début : {{ formatDate(selectedEnrollment.startDate) }}</span>
            <span v-if="selectedEnrollment.certificateIssued" class="cert-badge">
              <i class="pi pi-verified" /> Certificat délivré
            </span>
          </div>
          <div class="hero-progress-wrap">
            <div class="hero-progress-label">
              <span>Progression globale</span>
              <strong>{{ progressValue(selectedEnrollment.progressPercentage) }} %</strong>
            </div>
            <ProgressBar
              :value="progressValue(selectedEnrollment.progressPercentage)"
              :show-value="false"
              class="hero-progress"
              aria-label="Progression globale de la formation"
            />
          </div>
        </div>
      </div>

      <!-- Chargement du détail -->
      <div v-if="loadingDetail" class="list-skeleton">
        <Skeleton v-for="i in 4" :key="i" height="3.5rem" border-radius="14px" />
      </div>

      <template v-else-if="selectedEnrollment">
        <!-- Arborescence modules / leçons -->
        <div v-if="modules.length > 0" class="modules-section">
          <h2 class="section-heading">Programme</h2>

          <div class="modules-list">
            <div
              v-for="mod in modules"
              :key="mod.id"
              class="module-block"
              :class="{ 'module-block--open': isOpen(mod.id) }"
            >
              <!-- En-tête module -->
              <button
                class="module-header"
                :aria-expanded="isOpen(mod.id)"
                :aria-controls="`mod-lessons-${mod.id}`"
                @click="toggleModule(mod.id)"
              >
                <div class="module-header-left">
                  <i
                    class="pi module-chevron"
                    :class="isOpen(mod.id) ? 'pi-chevron-down' : 'pi-chevron-right'"
                  />
                  <div class="module-info">
                    <span class="module-title">{{ mod.title }}</span>
                    <span class="module-count">{{ mod.lessons.length }} leçon(s)</span>
                  </div>
                </div>
                <div class="module-header-right">
                  <div class="module-progress-mini">
                    <ProgressBar
                      :value="mod.progressPct"
                      :show-value="false"
                      class="module-progress-bar"
                    />
                    <span class="module-progress-pct">{{ mod.progressPct }} %</span>
                  </div>
                </div>
              </button>

              <!-- Leçons -->
              <div
                v-if="isOpen(mod.id)"
                :id="`mod-lessons-${mod.id}`"
                class="lessons-list"
              >
                <div v-if="mod.lessons.length === 0" class="lessons-empty">
                  <i class="pi pi-info-circle" /> Aucune leçon publiée dans ce module.
                </div>

                <button
                  v-for="lesson in mod.lessons"
                  :key="lesson.id"
                  class="lesson-row"
                  :class="`lesson-row--${lesson.status}`"
                  :aria-label="`${lesson.title} — ${LESSON_STATUS_CONFIG[lesson.status].label}. Cliquer pour ouvrir.`"
                  :disabled="updatingLesson === lesson.id"
                  @click="openLesson(lesson)"
                >
                  <!-- Icône statut -->
                  <span class="lesson-status-icon" :class="`icon--${lesson.status}`">
                    <i
                      v-if="updatingLesson !== lesson.id"
                      class="pi"
                      :class="LESSON_STATUS_CONFIG[lesson.status].icon"
                    />
                    <i v-else class="pi pi-spin pi-spinner" />
                  </span>

                  <!-- Infos -->
                  <div class="lesson-info">
                    <span class="lesson-title">{{ lesson.title }}</span>
                    <div class="lesson-meta">
                      <span v-if="lesson.lessonType" class="lesson-type">
                        {{ lessonTypeLabel(lesson.lessonType) }}
                      </span>
                      <span v-if="lesson.durationMinutes" class="lesson-duration">
                        {{ lesson.durationMinutes }} min
                      </span>
                    </div>
                  </div>

                  <!-- Statut badge -->
                  <span class="lesson-status-label" :class="`label--${lesson.status}`">
                    {{ LESSON_STATUS_CONFIG[lesson.status].label }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="empty-state">
          <i class="pi pi-book" />
          <p>Aucun module disponible pour cette formation.</p>
        </div>

        <!-- Jalons du parcours -->
        <div v-if="milestones.length > 0 || true" class="milestones-section">
          <h2 class="section-heading">Jalons du parcours</h2>
          <div class="milestones-card">
            <MilestonesList :milestones="milestones" />
          </div>
        </div>
      </template>

      <!-- Pas encore de formation sélectionnée (multiple enrollments) -->
      <div v-else-if="!selectedEnrollment && activeEnrollments.length > 1" class="pick-hint">
        <i class="pi pi-arrow-up" />
        <p>Sélectionnez une formation ci-dessus pour voir votre programme.</p>
      </div>

      <!-- Autres enrollments (non actifs) si aucun actif -->
      <div v-if="activeEnrollments.length === 0 && enrollments.length > 0" class="others-section">
        <h2 class="section-heading">Historique</h2>
        <div class="cards-grid">
          <article
            v-for="e in enrollments"
            :key="e.id"
            class="enrollment-card-mini"
          >
            <div class="mini-top">
              <span class="mini-session">{{ e.session.name }}</span>
              <Tag
                :value="STATUS_LABELS[e.status] ?? e.status"
                :severity="STATUS_SEVERITY[e.status] ?? 'secondary'"
              />
            </div>
            <div class="mini-progress">
              <ProgressBar :value="progressValue(e.progressPercentage)" :show-value="false" />
              <span class="mini-pct">{{ progressValue(e.progressPercentage) }} %</span>
            </div>
          </article>
        </div>
      </div>
    </template>
  </div>

  <!-- Dialog lecteur de leçon -->
  <Dialog
    v-model:visible="lessonDialogVisible"
    :header="activeLesson?.title ?? ''"
    modal
    :style="{ width: 'min(680px, 95vw)' }"
    :pt="{ root: { class: 'lesson-dialog' } }"
    @hide="activeLesson = null"
  >
    <template v-if="activeLesson">
      <!-- Méta -->
      <div class="lesson-dialog-meta">
        <Tag v-if="activeLesson.lessonType" :value="lessonTypeLabel(activeLesson.lessonType)" severity="info" />
        <span v-if="activeLesson.durationMinutes" class="dialog-duration">
          <i class="pi pi-clock" /> {{ activeLesson.durationMinutes }} min
        </span>
        <Tag
          :value="LESSON_STATUS_CONFIG[activeLesson.status].label"
          :severity="activeLesson.status === 'completed' ? 'success' : activeLesson.status === 'in_progress' ? 'warn' : 'secondary'"
        />
      </div>

      <!-- Contenu -->
      <div class="lesson-dialog-content">
        <div v-if="activeLesson.content" class="lesson-content-body" v-html="activeLesson.content" />
        <div v-else class="lesson-no-content">
          <i class="pi pi-info-circle" />
          <span>Pas de contenu disponible pour cette leçon.</span>
        </div>
      </div>

      <!-- Actions statut -->
      <div class="lesson-dialog-actions">
        <Button
          v-if="activeLesson.status !== 'in_progress'"
          label="Marquer comme en cours"
          icon="pi pi-circle-fill"
          severity="warn"
          outlined
          size="small"
          :loading="updatingLesson === activeLesson.id"
          @click="setLessonStatus(activeLesson!, 'in_progress')"
        />
        <Button
          v-if="activeLesson.status !== 'completed'"
          label="Terminer la leçon"
          icon="pi pi-check-circle"
          severity="success"
          size="small"
          :loading="updatingLesson === activeLesson.id"
          @click="setLessonStatus(activeLesson!, 'completed')"
        />
        <Button
          v-if="activeLesson.status !== 'not_started'"
          label="Réinitialiser"
          icon="pi pi-refresh"
          severity="secondary"
          text
          size="small"
          :loading="updatingLesson === activeLesson.id"
          @click="setLessonStatus(activeLesson!, 'not_started')"
        />
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.parcours-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.list-skeleton { display: flex; flex-direction: column; gap: 0.75rem; }

/* Vide */
.empty-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 4rem 2rem;
  text-align: center;
  color: #675c9c;
}
.empty-hero h2 { margin: 0; font-size: 1.25rem; font-weight: 700; color: #4c1d95; }
.empty-hero p  { margin: 0; font-size: 0.9rem; }
.empty-icon    { font-size: 3rem; opacity: 0.3; }

/* Sélecteur */
.enrollment-selector { display: flex; flex-direction: column; gap: 0.375rem; }
.selector-label {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #5b21b6;
}

/* Hero card */
.enrollment-hero {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.65);
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(139, 92, 246, 0.08);
}

.hero-left {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}

.hero-session {
  font-size: 1.2rem;
  font-weight: 700;
  color: #1e1b4b;
}

.hero-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  justify-content: flex-end;
  min-width: 260px;
}

.hero-dates {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #675c9c;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.cert-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #15803d;
  font-weight: 600;
}

.hero-progress-wrap { display: flex; flex-direction: column; gap: 0.375rem; }
.hero-progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: #675c9c;
}

.hero-progress {
  height: 10px !important;
}

:deep(.hero-progress.p-progressbar) {
  background: rgba(196, 181, 253, 0.3) !important;
  border-radius: 5px !important;
  height: 10px !important;
}

:deep(.hero-progress .p-progressbar-value) {
  background: linear-gradient(90deg, #8b5cf6, #6366f1) !important;
  border-radius: 5px !important;
}

/* Section headings */
.section-heading {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #675c9c;
  margin: 0 0 0.875rem;
}

/* Modules */
.modules-section { display: flex; flex-direction: column; }
.modules-list    { display: flex; flex-direction: column; gap: 0.625rem; }

.module-block {
  background: rgba(255, 255, 255, 0.50);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.60);
  border-radius: 16px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.module-block--open {
  box-shadow: 0 4px 20px rgba(139, 92, 246, 0.08);
}

.module-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: background 0.15s;
}

.module-header:hover { background: rgba(167, 139, 250, 0.07); }

.module-header-left  { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
.module-header-right { flex-shrink: 0; }

.module-chevron { font-size: 0.8rem; color: #8b5cf6; transition: transform 0.2s; }
.module-block--open .module-chevron { transform: rotate(0deg); }

.module-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.module-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e1b4b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.module-count { font-size: 0.72rem; color: #6b7280; }

.module-progress-mini { display: flex; align-items: center; gap: 0.5rem; width: 120px; }
.module-progress-bar  { flex: 1; height: 6px !important; }

:deep(.module-progress-bar.p-progressbar) {
  background: rgba(196, 181, 253, 0.3) !important;
  border-radius: 3px !important;
  height: 6px !important;
}

:deep(.module-progress-bar .p-progressbar-value) {
  background: linear-gradient(90deg, #8b5cf6, #6366f1) !important;
  border-radius: 3px !important;
}

.module-progress-pct { font-size: 0.72rem; color: #6d28d9; font-weight: 600; white-space: nowrap; }

/* Leçons */
.lessons-list {
  display: flex;
  flex-direction: column;
  border-top: 1px solid rgba(196, 181, 253, 0.15);
  padding: 0.5rem 0;
}

.lessons-empty {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1.5rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.lesson-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 1.25rem;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s;
}

.lesson-row:hover:not(:disabled) { background: rgba(167, 139, 250, 0.07); }
.lesson-row:disabled { cursor: default; }

.lesson-row--completed { opacity: 0.85; }

/* Status icon */
.lesson-status-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
  transition: all 0.2s;
}

.icon--not_started { color: rgba(196, 181, 253, 0.7); }
.icon--in_progress { color: #f59e0b; }
.icon--completed   { color: #22c55e; }

.lesson-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.lesson-title {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e1b4b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lesson-meta { display: flex; gap: 0.5rem; }
.lesson-type, .lesson-duration {
  font-size: 0.7rem;
  color: #6b7280;
  background: rgba(0,0,0,0.04);
  padding: 1px 6px;
  border-radius: 6px;
}

/* Status label */
.lesson-status-label {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 10px;
  flex-shrink: 0;
}

.label--not_started { background: rgba(196, 181, 253, 0.2); color: #6d28d9; }
.label--in_progress { background: rgba(253, 230, 138, 0.3); color: #b45309; }
.label--completed   { background: rgba(134, 239, 172, 0.25); color: #15803d; }

/* Milestones */
.milestones-section { display: flex; flex-direction: column; }
.milestones-card {
  background: rgba(255, 255, 255, 0.50);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.60);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
}

/* Pick hint */
.pick-hint {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: #675c9c;
  font-size: 0.9rem;
  background: rgba(237, 233, 254, 0.3);
  border-radius: 14px;
  border: 1px dashed rgba(196, 181, 253, 0.4);
}

/* Others / historique */
.others-section { display: flex; flex-direction: column; }
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}

.enrollment-card-mini {
  padding: 1rem 1.25rem;
  background: rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.mini-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.mini-session { font-weight: 600; font-size: 0.9rem; color: #1e1b4b; }
.mini-progress { display: flex; align-items: center; gap: 0.5rem; }
.mini-pct { font-size: 0.75rem; color: #6d28d9; font-weight: 600; white-space: nowrap; }

/* Error / empty */
.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #675c9c;
}
.empty-state .pi { font-size: 2rem; opacity: 0.4; }
.empty-state p   { margin: 0; font-size: 0.9rem; }

/* Sections */
.milestones-section, .modules-section, .others-section { gap: 0.5rem; }

/* Dialog leçon */
.lesson-dialog-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.dialog-duration {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: #6b7280;
}

.lesson-dialog-content {
  min-height: 120px;
  max-height: 420px;
  overflow-y: auto;
  margin-bottom: 1.25rem;
  padding: 1rem 1.125rem;
  background: rgba(237, 233, 254, 0.15);
  border: 1px solid rgba(196, 181, 253, 0.25);
  border-radius: 12px;
  font-size: 0.9rem;
  line-height: 1.7;
  color: #1e1b4b;
}

.lesson-content-body :deep(h1),
.lesson-content-body :deep(h2),
.lesson-content-body :deep(h3) {
  color: #4c1d95;
  margin-top: 1em;
}

.lesson-content-body :deep(pre),
.lesson-content-body :deep(code) {
  background: rgba(0,0,0,0.05);
  border-radius: 6px;
  padding: 0.15em 0.4em;
  font-size: 0.875em;
}

.lesson-no-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
  font-style: italic;
}

.lesson-dialog-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: flex-end;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
}
</style>
