<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useFormations } from '@/composables/useFormations'
import FormationForm from '@/components/formations/FormationForm.vue'
import type { FormationFormationRead, FormationFormationWriteJsonMergePatch } from '@/api'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { fetchFormation, updateFormation, deleteFormation } = useFormations()

const formation = ref<FormationFormationRead | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const canEdit = computed(() =>
  auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_FORMATEUR') || auth.hasRole('ROLE_DIRECTEUR'),
)
const canDelete = computed(() => auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR'))

onMounted(async () => {
  const id = route.params.id as string
  formation.value = await fetchFormation(id)
  if (!formation.value) error.value = 'Formation introuvable.'
  if (formation.value) document.title = `${formation.value.title} — Auxilium`
  loading.value = false
})

// ── Level label ──
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert',
}
const levelLabel = computed(() =>
  formation.value?.level ? (LEVEL_LABELS[formation.value.level] ?? formation.value.level) : null,
)

// ── Edit Dialog ──
const showEdit = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)

async function handleEdit(payload: Record<string, unknown>) {
  if (!formation.value?.id) return
  saving.value = true
  saveError.value = null
  try {
    formation.value = await updateFormation(
      formation.value.id,
      payload as FormationFormationWriteJsonMergePatch,
    )
    showEdit.value = false
  } catch {
    saveError.value = 'Une erreur est survenue lors de la modification.'
  } finally {
    saving.value = false
  }
}

// ── Delete ──
const showDeleteConfirm = ref(false)
const deleting = ref(false)

async function handleDelete() {
  if (!formation.value?.id) return
  deleting.value = true
  const ok = await deleteFormation(formation.value.id)
  deleting.value = false
  if (ok) {
    router.push({ name: 'formations' })
  } else {
    error.value = 'Impossible de supprimer cette formation.'
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <div class="detail-page">
    <!-- Back -->
    <Button
      icon="pi pi-arrow-left"
      label="Retour aux formations"
      text
      severity="secondary"
      class="back-btn"
      @click="router.push({ name: 'formations' })"
    />

    <!-- Loading -->
    <div v-if="loading" class="detail-skeleton">
      <Skeleton height="2.5rem" width="60%" class="mb-3" />
      <Skeleton height="1rem" width="40%" class="mb-4" />
      <div class="skeleton-cards">
        <Skeleton v-for="n in 3" :key="n" height="5rem" border-radius="16px" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="dash-error" role="alert">
      <i class="pi pi-exclamation-triangle" /> {{ error }}
    </div>

    <!-- Content -->
    <template v-else-if="formation">
      <!-- Header -->
      <div class="detail-header">
        <div class="detail-title-row">
          <h1 class="detail-title">{{ formation.title }}</h1>
          <div class="detail-badges">
            <Tag :value="formation.code" severity="secondary" />
            <Tag v-if="levelLabel" :value="levelLabel" severity="info" />
            <Tag
              :value="formation.isActive ? 'Active' : 'Inactive'"
              :severity="formation.isActive ? 'success' : 'secondary'"
            />
          </div>
        </div>

        <div v-if="canEdit || canDelete" class="detail-actions">
          <Button
            v-if="canEdit"
            label="Modifier"
            icon="pi pi-pencil"
            severity="secondary"
            @click="showEdit = true"
          />
          <Button
            v-if="canDelete"
            label="Supprimer"
            icon="pi pi-trash"
            severity="danger"
            outlined
            @click="showDeleteConfirm = true"
          />
        </div>
      </div>

      <!-- Stats cards -->
      <div class="detail-stats">
        <div class="stat-card">
          <i class="pi pi-clock stat-icon" />
          <span class="stat-val">{{ formation.durationHours ?? '—' }}</span>
          <span class="stat-lbl">heures</span>
        </div>
        <div class="stat-card">
          <i class="pi pi-users stat-icon" />
          <span class="stat-val">{{ formation.maxCapacity ?? '—' }}</span>
          <span class="stat-lbl">places max</span>
        </div>
        <div class="stat-card">
          <i class="pi pi-tag stat-icon" />
          <span class="stat-val">{{ formation.category?.name ?? '—' }}</span>
          <span class="stat-lbl">catégorie</span>
        </div>
      </div>

      <!-- Sections -->
      <div class="detail-sections">
        <div class="detail-section">
          <h2 class="section-heading">Description</h2>
          <p class="section-body">{{ formation.description }}</p>
        </div>

        <div class="detail-section">
          <h2 class="section-heading">Objectifs pédagogiques</h2>
          <p class="section-body">{{ formation.objectives }}</p>
        </div>

        <div v-if="formation.prerequisites" class="detail-section">
          <h2 class="section-heading">Prérequis</h2>
          <p class="section-body">{{ formation.prerequisites }}</p>
        </div>

        <div v-if="formation.formateurs?.length" class="detail-section">
          <h2 class="section-heading">Formateurs associés</h2>
          <div class="formateurs-list">
            <Tag v-for="iri in formation.formateurs" :key="iri" :value="iri" severity="secondary" />
          </div>
        </div>
      </div>
    </template>

    <!-- Dialog édition -->
    <Dialog
      v-model:visible="showEdit"
      modal
      header="Modifier la formation"
      :style="{ width: '680px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <FormationForm
        :formation="formation"
        :saving="saving"
        :save-error="saveError"
        @submit="handleEdit"
        @cancel="showEdit = false"
      />
    </Dialog>

    <!-- Dialog suppression -->
    <Dialog
      v-model:visible="showDeleteConfirm"
      modal
      header="Supprimer la formation"
      :style="{ width: '420px' }"
      :draggable="false"
      class="glass-dialog"
    >
      <p class="delete-msg">
        Confirmer la suppression de <strong>{{ formation?.title }}</strong> ?
        Cette action est irréversible.
      </p>
      <div class="delete-actions">
        <Button label="Annuler" severity="secondary" text @click="showDeleteConfirm = false" />
        <Button
          label="Supprimer"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleting"
          @click="handleDelete"
        />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.detail-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.back-btn {
  align-self: flex-start;
  margin-bottom: -0.5rem;
}

.detail-skeleton {
  display: flex;
  flex-direction: column;
}

.skeleton-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

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

/* Header */
.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.detail-title-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e1b4b;
  margin: 0;
  letter-spacing: -0.025em;
}

.detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.detail-actions {
  display: flex;
  gap: 0.625rem;
  flex-shrink: 0;
}

/* Stat cards */
.detail-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 1.25rem 1rem;
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 18px;
  text-align: center;
}

.stat-icon {
  font-size: 1.25rem;
  background: linear-gradient(135deg, #a78bfa, #818cf8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 0.25rem;
}

.stat-val {
  font-size: 1.5rem;
  font-weight: 700;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-lbl {
  font-size: 0.75rem;
  color: #675c9c;
}

/* Sections */
.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.detail-section {
  padding: 1.25rem 1.5rem;
  background: rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 18px;
}

.section-heading {
  font-size: 0.8rem;
  font-weight: 700;
  color: #5b21b6;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 0.75rem;
}

.section-body {
  font-size: 0.9375rem;
  color: #374151;
  line-height: 1.65;
  margin: 0;
  white-space: pre-wrap;
}

.formateurs-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Dialog */
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

.delete-msg {
  margin: 0 0 1.5rem;
  color: #374151;
  line-height: 1.6;
}

.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
