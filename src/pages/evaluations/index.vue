<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useEvaluations } from '@/composables/useEvaluations'
import type { EvaluationSubmissionSubmissionReadUserSummary } from '@/api'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const auth = useAuthStore()
const toast = useToast()
const {
  evaluations,
  pendingGrading,
  loading,
  error,
  erreurCopies,
  lectureCopiesReussie,
  fetchEvaluations,
  gradeSubmission,
} = useEvaluations()

const activeTab = ref('evaluations')
const canGrade = computed(() =>
  auth.hasRole('ROLE_FORMATEUR') || auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR'),
)

function getUserName(user: { firstName?: string; lastName?: string } | string | null | undefined): string {
  if (!user) return '—'
  if (typeof user === 'object') return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—'
  return `#${user.split('/').pop()}`
}

// ── Evaluation lookup ──
const evalMap = computed(() => {
  const map = new Map<string, string>()
  for (const ev of evaluations.value) {
    if (ev.id) map.set(`/api/evaluations/${ev.id}`, ev.title)
  }
  return map
})

function getEvalTitle(iri: string | null | undefined): string {
  if (!iri) return '—'
  return evalMap.value.get(iri) ?? `#${iri.split('/').pop()}`
}

/**
 * ⚠ CETTE FONCTION N'EST JUSTE QUE PARCE QUE `/api/evaluations` REND 12 SUR 12.
 *
 * Elle borne la saisie de la note en DEUX endroits — la validation de `handleGrade` et
 * l'attribut `:max` du champ `InputNumber` — et elle retombe SILENCIEUSEMENT sur 100
 * quand le `find()` échoue.
 *
 * Paginer cette collection créerait donc un défaut qui n'existe pas aujourd'hui : une
 * évaluation située au-delà de la page serait introuvable, `parseFloat('100')`
 * deviendrait le barème, et une note de 90 serait acceptée sur un devoir noté sur 20 —
 * sans une seule erreur, ni à la compilation ni à l'exécution.
 *
 * Si cette collection dépasse un jour 30 éléments, c'est CE repli qu'il faut traiter en
 * premier, avant le tableau.
 */
function getEvalMaxScore(iri: string | null | undefined): number {
  if (!iri) return 100
  const ev = evaluations.value.find((e) => `/api/evaluations/${e.id}` === iri)
  return parseFloat(ev?.maxScore ?? '100')
}

onMounted(() => {
  document.title = 'Évaluations — Auxilium'
  fetchEvaluations()
})

// ── Helpers ──
const EVAL_TYPE_LABELS: Record<string, string> = {
  qcm:        'QCM',
  text_libre: 'Texte libre',
  mix:        'Mixte',
  quiz:       'Quiz',
  assignment: 'Devoir',
  exam:       'Examen',
  practical:  'Pratique',
  project:    'Projet',
}

function evalTypeLabel(t: string | null | undefined): string {
  return t ? (EVAL_TYPE_LABELS[t] ?? t) : '—'
}

function evalTypeSeverity(t: string | null | undefined): 'info' | 'warn' | 'secondary' {
  if (t === 'qcm') return 'info'
  if (t === 'text_libre') return 'warn'
  return 'secondary'
}

const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  not_started:    'Non commencé',
  in_progress:    'En cours',
  submitted:      'Soumis',
  pending_review: 'À noter',
  graded:         'Noté',
  failed:         'Échoué',
}
const SUBMISSION_STATUS_SEVERITY: Record<string, 'secondary' | 'warn' | 'info' | 'success' | 'danger'> = {
  not_started:    'secondary',
  in_progress:    'warn',
  submitted:      'info',
  pending_review: 'warn',
  graded:         'success',
  failed:         'danger',
}

function subLabel(s: string)    { return SUBMISSION_STATUS_LABELS[s] ?? s }
function subSeverity(s: string) { return SUBMISSION_STATUS_SEVERITY[s] ?? 'secondary' }

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

// ── Grading Dialog ──
const showGrade    = ref(false)
const gradeTarget  = ref<EvaluationSubmissionSubmissionReadUserSummary | null>(null)
const gradeScore   = ref<number | null>(null)
const gradeFeedback = ref('')
const grading      = ref(false)
const gradeError   = ref<string | null>(null)

function openGrade(submission: EvaluationSubmissionSubmissionReadUserSummary) {
  gradeTarget.value  = submission
  gradeScore.value   = null
  gradeFeedback.value = ''
  gradeError.value   = null
  showGrade.value    = true
}

const gradeMaxScore = computed(() =>
  gradeTarget.value ? getEvalMaxScore(gradeTarget.value.evaluation) : 100,
)

async function handleGrade() {
  if (gradeScore.value === null) { gradeError.value = 'La note est obligatoire.'; return }
  if (gradeScore.value < 0 || gradeScore.value > gradeMaxScore.value) {
    gradeError.value = `La note doit être entre 0 et ${gradeMaxScore.value}.`
    return
  }
  if (!gradeTarget.value?.id) return

  grading.value = true
  gradeError.value = null
  try {
    await gradeSubmission(
      gradeTarget.value.id,
      String(gradeScore.value),
      gradeFeedback.value.trim(),
    )
    showGrade.value = false
    toast.add({ severity: 'success', summary: 'Note enregistrée', life: 3000 })
    await fetchEvaluations()
  } catch {
    gradeError.value = 'Une erreur est survenue lors de l\'enregistrement.'
  } finally {
    grading.value = false
  }
}
</script>

<template>
  <div class="evaluations-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>Évaluations</h1>
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton" aria-label="Chargement des évaluations">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" border-radius="10px" />
    </div>

    <!-- Contenu avec onglets -->
    <Tabs v-else v-model:value="activeTab" class="glass-tabs">
      <TabList>
        <Tab value="evaluations" aria-controls="panel-evaluations">
          Toutes les évaluations
        </Tab>
        <Tab v-if="canGrade" value="pending" aria-controls="panel-pending">
          À noter
          <!--
            Le badge n'est rendu que si la file a été lue EN ENTIER. Sinon il annoncerait
            le compte d'une page au lieu de celui de la file — c'est très exactement le
            « 1 » qui masquait 5 copies.
          -->
          <span v-if="lectureCopiesReussie && pendingGrading.length > 0" class="tab-badge">
            {{ pendingGrading.length }}
          </span>
        </Tab>
      </TabList>

      <TabPanels>
        <!-- ── Onglet : liste des évaluations ── -->
        <TabPanel id="panel-evaluations" value="evaluations">
          <DataTable
            :value="evaluations"
            paginator
            :rows="20"
            :rows-per-page-options="[10, 20, 50]"
            aria-label="Liste des évaluations"
            class="glass-table"
          >
            <template #empty>
              <div class="empty-state">
                <i class="pi pi-check-circle" />
                <p>Aucune évaluation trouvée.</p>
              </div>
            </template>

            <Column field="title" header="Titre" sortable style="min-width: 200px" />

            <Column header="Type" style="width: 130px">
              <template #body="{ data }">
                <Tag
                  :value="evalTypeLabel(data.evaluationType)"
                  :severity="evalTypeSeverity(data.evaluationType)"
                />
              </template>
            </Column>

            <Column header="Note max" style="width: 100px; text-align:right">
              <template #body="{ data }">{{ data.maxScore }}</template>
            </Column>

            <Column header="Seuil réussite" style="width: 120px; text-align:right">
              <template #body="{ data }">{{ data.passingScore }}</template>
            </Column>

            <Column header="Durée (min)" style="width: 110px; text-align:right">
              <template #body="{ data }">{{ data.durationMinutes ?? '—' }}</template>
            </Column>

            <Column header="Publié" style="width: 90px">
              <template #body="{ data }">
                <Tag
                  :value="data.isPublished ? 'Oui' : 'Non'"
                  :severity="data.isPublished ? 'success' : 'secondary'"
                />
              </template>
            </Column>

            <Column header="Obligatoire" style="width: 105px">
              <template #body="{ data }">
                <Tag
                  :value="data.isMandatory ? 'Oui' : 'Non'"
                  :severity="data.isMandatory ? 'warn' : 'secondary'"
                />
              </template>
            </Column>

            <Column header="Disponible du" style="width: 130px">
              <template #body="{ data }">{{ formatDate(data.availableFrom) }}</template>
            </Column>
          </DataTable>
        </TabPanel>

        <!-- ── Onglet : À noter ── -->
        <TabPanel v-if="canGrade" id="panel-pending" value="pending">
          <!--
            ÉTAT « LECTURE EN ÉCHEC » — role="alert" et non aria-live="polite" : ce n'est
            pas une annonce de résultat, c'est l'aveu qu'on ne sait pas. Le tableau n'est
            pas rendu du tout, donc la phrase « Tout est noté » est inatteignable ici.
          -->
          <div v-if="erreurCopies" role="alert" class="dash-error">
            <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ erreurCopies }}
          </div>

          <DataTable
            v-else
            :value="pendingGrading"
            paginator
            :rows="20"
            aria-label="Soumissions en attente de notation"
            class="glass-table"
          >
            <!--
              ⚠ INVARIANT — NE PAS RÉTABLIR ICI UNE CONDITION SUR UN TOTAL.
              `lireCollectionComplete` garantit `membres.length === total` : une fois la
              lecture réussie, un tableau vide PROUVE que le serveur en annonce zéro. Il
              n'y a donc pas de second nombre à lire, et la bonne question n'est pas
              « le total vaut-il 0 ? » mais « la lecture a-t-elle réussi ? » — tranchée
              par le `v-if` ci-dessus.

              C'est ce qui rend cette phrase VRAIE. Avant le 12 septembre 2026 elle
              s'affichait dès que la page reçue était vide : le badge annonçait 1 copie
              pour 5 réelles, et noter la seule visible faisait dire à l'écran « Tout est
              noté » pendant que quatre copies attendaient. Un écran qui dit « il n'y a
              rien » dit au correcteur d'arrêter de chercher.
            -->
            <template #empty>
              <div class="empty-state">
                <i class="pi pi-check-circle" style="color: #86efac" />
                <p>Tout est noté — aucune soumission en attente !</p>
              </div>
            </template>

            <!-- Stagiaire -->
            <Column header="Stagiaire" style="min-width: 160px">
              <template #body="{ data }">
                <div class="user-cell">
                  <div class="user-avatar-sm">
                    {{ getUserName(data.user).split(' ').map((n: string) => n[0]).join('').slice(0, 2) }}
                  </div>
                  <span>{{ getUserName(data.user) }}</span>
                </div>
              </template>
            </Column>

            <!-- Évaluation -->
            <Column header="Évaluation" style="min-width: 180px">
              <template #body="{ data }">
                <span class="eval-title">{{ getEvalTitle(data.evaluation) }}</span>
              </template>
            </Column>

            <!-- Tentative -->
            <Column header="Tentative" style="width: 95px; text-align:right">
              <template #body="{ data }">{{ data.attemptNumber }}</template>
            </Column>

            <!-- Note max -->
            <Column header="Note max" style="width: 95px; text-align:right">
              <template #body="{ data }">{{ data.maxScore }}</template>
            </Column>

            <!-- Statut -->
            <Column header="Statut" style="width: 110px">
              <template #body="{ data }">
                <Tag :value="subLabel(data.status)" :severity="subSeverity(data.status)" />
              </template>
            </Column>

            <!-- Soumis le -->
            <Column header="Soumis le" style="width: 115px">
              <template #body="{ data }">{{ formatDate(data.submittedAt) }}</template>
            </Column>

            <!-- Action -->
            <Column header="" style="width: 100px">
              <template #body="{ data }">
                <Button
                  label="Noter"
                  icon="pi pi-pencil"
                  size="small"
                  @click="openGrade(data)"
                />
              </template>
            </Column>
          </DataTable>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- ── Dialog notation ── -->
    <Dialog
      v-model:visible="showGrade"
      modal
      header="Notation manuelle"
      :style="{ width: '480px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <div v-if="gradeTarget" class="grade-form">
        <!-- Context -->
        <div class="grade-context">
          <div class="grade-context-row">
            <i class="pi pi-user grade-icon" />
            <span>{{ getUserName(gradeTarget.user) }}</span>
          </div>
          <div class="grade-context-row">
            <i class="pi pi-check-circle grade-icon" />
            <span>{{ getEvalTitle(gradeTarget.evaluation) }}</span>
          </div>
          <div class="grade-context-row">
            <i class="pi pi-info-circle grade-icon" />
            <span>Note max : <strong>{{ gradeMaxScore }}</strong> — Tentative {{ gradeTarget.attemptNumber }}</span>
          </div>
        </div>

        <div v-if="gradeError" class="grade-error" role="alert">
          <i class="pi pi-exclamation-circle" /> {{ gradeError }}
        </div>

        <!-- Score -->
        <div class="field">
          <label for="gd-score">Note obtenue <span class="req">*</span></label>
          <InputNumber
            id="gd-score"
            v-model="gradeScore"
            :min="0"
            :max="gradeMaxScore"
            :invalid="!!gradeError && gradeScore === null"
            placeholder="0"
            fluid
            show-buttons
          />
          <small class="field-hint">Entre 0 et {{ gradeMaxScore }}</small>
        </div>

        <!-- Feedback -->
        <div class="field">
          <label for="gd-feedback">Commentaire</label>
          <Textarea
            id="gd-feedback"
            v-model="gradeFeedback"
            rows="4"
            placeholder="Retour personnalisé pour le stagiaire…"
            style="width: 100%"
          />
        </div>

        <div class="grade-actions">
          <Button label="Annuler" severity="secondary" text :disabled="grading" @click="showGrade = false" />
          <Button
            label="Enregistrer la note"
            icon="pi pi-check"
            :loading="grading"
            @click="handleGrade"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.evaluations-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.list-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }

/* Tabs glass */
.glass-tabs {
  background: transparent;
}

:deep(.p-tablist) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px) !important;
  border-radius: 14px 14px 0 0 !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
  padding: 0 0.75rem !important;
}

:deep(.p-tab) {
  color: #675c9c !important;
  font-weight: 500 !important;
  border-radius: 0 !important;
  border-bottom: 2px solid transparent !important;
  transition: color 0.15s, border-color 0.15s !important;
  padding: 0.875rem 1rem !important;
}

:deep(.p-tab[aria-selected="true"]),
:deep(.p-tab.p-tab-active) {
  color: #6d28d9 !important;
  border-bottom-color: #8b5cf6 !important;
  font-weight: 600 !important;
}

:deep(.p-tabpanels) {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px) !important;
  border-radius: 0 0 14px 14px !important;
  border: 1px solid rgba(255, 255, 255, 0.55) !important;
  border-top: none !important;
  padding: 1.25rem !important;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: #b91c1c;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  margin-left: 0.4rem;
  padding: 0 5px;
}

/* Table glass */
.glass-table {
  background: transparent !important;
}

:deep(.glass-table .p-datatable-header-cell) {
  background: rgba(237, 233, 254, 0.5) !important;
  color: #5b21b6 !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
}

:deep(.glass-table .p-datatable-tbody > tr) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.12) !important;
  transition: background 0.15s;
}

:deep(.glass-table .p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.07) !important;
}

/* Cells */
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.user-avatar-sm {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  flex-shrink: 0;
}

.eval-title {
  font-weight: 500;
  color: #1e1b4b;
}

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
.empty-state p { margin: 0; font-size: 0.9rem; }

/* Grading Dialog */
:deep(.glass-dialog .p-dialog) {
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(24px) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  border-radius: 20px !important;
}

:deep(.glass-dialog .p-dialog-header) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2) !important;
  padding: 1.25rem 1.5rem !important;
}

:deep(.glass-dialog .p-dialog-title) {
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  color: #4c1d95 !important;
}

:deep(.glass-dialog .p-dialog-content) {
  background: transparent !important;
  padding: 1.5rem !important;
}

.grade-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.grade-context {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: rgba(237, 233, 254, 0.35);
  border-radius: 12px;
  border: 1px solid rgba(196, 181, 253, 0.3);
}

.grade-context-row {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: #374151;
}

.grade-icon {
  color: #8b5cf6;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.grade-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.45);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 10px;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b21b6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.req { color: #b91c1c; margin-left: 2px; }
.field-hint { color: #675c9c; font-size: 0.75rem; }

.grade-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
}
</style>
