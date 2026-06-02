<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDocuments } from '@/composables/useDocuments'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'
import type { DocumentDocumentRead } from '@/api'

const auth  = useToast()
const toast = useToast()
const { documents, loading, error, fetchDocuments, downloadDocument, uploadDocument } = useDocuments()
const authStore = useAuthStore()

const canUpload = computed(() =>
  authStore.hasRole('ROLE_ADMIN') || authStore.hasRole('ROLE_FORMATEUR') || authStore.hasRole('ROLE_DIRECTEUR'),
)

onMounted(() => {
  document.title = 'Documents — Auxilium'
  fetchDocuments()
})

// ── Filtres ──
const search            = ref('')
const filterVisibility  = ref('all')

const visibilityOptions = [
  { label: 'Toutes visibilités', value: 'all' },
  { label: 'Public',             value: 'public' },
  { label: 'Partagé',            value: 'shared' },
  { label: 'Privé',              value: 'private' },
]

const filtered = computed(() => {
  let list = documents.value
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((d) => d.title.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q))
  if (filterVisibility.value !== 'all') list = list.filter((d) => d.visibility === filterVisibility.value)
  return list
})

// ── Helpers ──
const VISIBILITY_LABELS: Record<string, string>   = { public: 'Public', shared: 'Partagé', private: 'Privé' }
const VISIBILITY_SEVERITY: Record<string, 'success' | 'info' | 'secondary'> = { public: 'success', shared: 'info', private: 'secondary' }

function visibilityLabel(v: string)   { return VISIBILITY_LABELS[v] ?? v }
function visibilitySeverity(v: string) { return VISIBILITY_SEVERITY[v] ?? 'secondary' }

function mimeIcon(mime: string): string {
  if (mime.includes('pdf'))          return 'pi-file-pdf'
  if (mime.includes('image'))        return 'pi-image'
  if (mime.includes('video'))        return 'pi-video'
  if (mime.startsWith('text'))       return 'pi-file-edit'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'pi-table'
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'pi-desktop'
  return 'pi-file'
}

function mimeColor(mime: string): string {
  if (mime.includes('pdf'))  return '#ef4444'
  if (mime.includes('image')) return '#8b5cf6'
  if (mime.includes('video')) return '#3b82f6'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '#22c55e'
  return '#6b7280'
}

function formatSize(raw: number | string | null | undefined): string {
  if (raw === null || raw === undefined) return '—'
  const b = typeof raw === 'string' ? parseFloat(raw) : raw
  if (isNaN(b)) return '—'
  if (b < 1024) return `${b} o`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} Ko`
  return `${(b / (1024 * 1024)).toFixed(1)} Mo`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

// ── Téléchargement ──
const downloading = ref<number | null>(null)

async function handleDownload(doc: DocumentDocumentRead) {
  if (!doc.id || downloading.value === doc.id) return
  downloading.value = doc.id
  try {
    await downloadDocument(doc)
  } catch {
    toast.add({ severity: 'error', summary: 'Téléchargement impossible', life: 3000 })
  } finally {
    downloading.value = null
  }
}

// ── Upload Dialog ──
const showUpload  = ref(false)
const uploading   = ref(false)
const uploadError = ref<string | null>(null)
const uploadTitle = ref('')
const uploadVisibility = ref('shared')
const uploadFile  = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

const MAX_SIZE_MB = 128

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file  = input.files?.[0] ?? null
  uploadError.value = null
  if (!file) { uploadFile.value = null; return }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    uploadError.value = `Fichier trop volumineux (max ${MAX_SIZE_MB} Mo).`
    uploadFile.value = null
    return
  }
  uploadFile.value = file
  if (!uploadTitle.value) uploadTitle.value = file.name.replace(/\.[^.]+$/, '')
}

function openUploadDialog() {
  uploadTitle.value      = ''
  uploadVisibility.value = 'shared'
  uploadFile.value       = null
  uploadError.value      = null
  showUpload.value       = true
}

const visibilityCandidates = [
  { label: 'Partagé (tous les utilisateurs)', value: 'shared' },
  { label: 'Public (sans connexion)',          value: 'public' },
  { label: 'Privé (moi uniquement)',           value: 'private' },
]

async function handleUpload() {
  if (!uploadFile.value) { uploadError.value = 'Sélectionnez un fichier.'; return }
  if (!uploadTitle.value.trim()) { uploadError.value = 'Le titre est obligatoire.'; return }

  uploading.value = true
  uploadError.value = null
  try {
    const fd = new FormData()
    fd.append('file',       uploadFile.value)
    fd.append('title',      uploadTitle.value.trim())
    fd.append('visibility', uploadVisibility.value)
    fd.append('fileName',   uploadFile.value.name)
    fd.append('mimeType',   uploadFile.value.type || 'application/octet-stream')
    fd.append('fileSize',   String(uploadFile.value.size))
    fd.append('filePath',   '')           // set server-side by processor

    await uploadDocument(fd)
    showUpload.value = false
    toast.add({ severity: 'success', summary: 'Document uploadé', life: 3000 })
    await fetchDocuments()
  } catch (e) {
    uploadError.value = (e as Error).message || 'Erreur lors de l\'upload.'
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="documents-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>Documents</h1>
      <Button
        v-if="canUpload"
        label="Ajouter un document"
        icon="pi pi-upload"
        @click="openUploadDialog"
      />
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" border-radius="10px" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par titre ou description…"
          aria-label="Rechercher un document"
          class="filter-search"
        />
        <Select
          v-model="filterVisibility"
          :options="visibilityOptions"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par visibilité"
          class="filter-visibility"
        />
      </div>

      <DataTable
        :value="filtered"
        paginator
        :rows="20"
        :rows-per-page-options="[10, 20, 50]"
        aria-label="Liste des documents"
        class="glass-table"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-folder-open" />
            <p>Aucun document trouvé.</p>
          </div>
        </template>

        <!-- Fichier -->
        <Column header="Fichier" style="min-width: 240px">
          <template #body="{ data }">
            <div class="file-cell">
              <span class="file-icon-wrap" :style="{ color: mimeColor(data.mimeType) }">
                <i :class="`pi ${mimeIcon(data.mimeType)}`" aria-hidden="true" />
              </span>
              <div class="file-info">
                <span class="file-title">{{ data.title }}</span>
                <span v-if="data.description" class="file-desc">{{ data.description }}</span>
              </div>
            </div>
          </template>
        </Column>

        <!-- Taille -->
        <Column header="Taille" style="width: 100px; text-align: right">
          <template #body="{ data }">{{ formatSize(data.fileSize) }}</template>
        </Column>

        <!-- Visibilité -->
        <Column header="Visibilité" style="width: 115px">
          <template #body="{ data }">
            <Tag :value="visibilityLabel(data.visibility)" :severity="visibilitySeverity(data.visibility)" />
          </template>
        </Column>

        <!-- Date -->
        <Column header="Ajouté le" style="width: 110px">
          <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
        </Column>

        <!-- Actions -->
        <Column header="" style="width: 80px">
          <template #body="{ data }">
            <Button
              icon="pi pi-download"
              text
              rounded
              size="small"
              aria-label="Télécharger le document"
              :loading="downloading === data.id"
              @click="handleDownload(data)"
            />
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Dialog upload -->
    <Dialog
      v-model:visible="showUpload"
      modal
      header="Ajouter un document"
      :style="{ width: '520px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <div class="upload-form">
        <div v-if="uploadError" class="form-banner-error" role="alert">
          <i class="pi pi-exclamation-circle" /> {{ uploadError }}
        </div>

        <!-- Titre -->
        <div class="field">
          <label for="up-title">Titre <span class="req">*</span></label>
          <InputText id="up-title" v-model="uploadTitle" placeholder="Nom du document" fluid />
        </div>

        <!-- Visibilité -->
        <div class="field">
          <label for="up-vis">Visibilité <span class="req">*</span></label>
          <Select
            id="up-vis"
            v-model="uploadVisibility"
            :options="visibilityCandidates"
            option-label="label"
            option-value="value"
            fluid
          />
        </div>

        <!-- Fichier -->
        <div class="field">
          <label>Fichier <span class="req">*</span></label>
          <div class="file-drop-zone" :class="{ 'file-drop-zone--selected': !!uploadFile }">
            <input
              ref="fileInputRef"
              type="file"
              class="file-input"
              @change="onFileChange"
            />
            <div v-if="!uploadFile" class="file-drop-hint">
              <i class="pi pi-cloud-upload drop-icon" />
              <span>Cliquez pour sélectionner un fichier</span>
              <span class="drop-limit">Max {{ MAX_SIZE_MB }} Mo</span>
            </div>
            <div v-else class="file-selected">
              <i class="pi pi-file-check" />
              <span>{{ uploadFile.name }}</span>
              <span class="file-size-hint">{{ formatSize(uploadFile.size) }}</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <Button label="Annuler" severity="secondary" text :disabled="uploading" @click="showUpload = false" />
          <Button label="Uploader" icon="pi pi-upload" :loading="uploading" @click="handleUpload" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.documents-page { display: flex; flex-direction: column; gap: 1.25rem; }
.list-skeleton  { display: flex; flex-direction: column; gap: 0.5rem; }

.filters { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.filter-search      { flex: 1; min-width: 200px; }
.filter-visibility  { width: 200px; }

/* Table glass */
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
  border-bottom: 1px solid rgba(196, 181, 253, 0.12) !important;
  transition: background 0.15s;
}

:deep(.p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.07) !important;
}

/* File cell */
.file-cell { display: flex; align-items: center; gap: 0.75rem; }
.file-icon-wrap { font-size: 1.25rem; flex-shrink: 0; }
.file-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.file-title { font-size: 0.875rem; font-weight: 600; color: #1e1b4b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.file-desc  { font-size: 0.72rem; color: #7c6fa0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Error / empty */
.dash-error {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.875rem;
}

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem; padding: 3rem 1rem; color: #7c6fa0;
}
.empty-state .pi { font-size: 2rem; opacity: 0.4; }
.empty-state p { margin: 0; font-size: 0.9rem; }

/* Upload Dialog */
:deep(.glass-dialog .p-dialog) {
  background: rgba(255, 255, 255, 0.72) !important; backdrop-filter: blur(24px) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important; border-radius: 20px !important;
}
:deep(.glass-dialog .p-dialog-header) {
  background: transparent !important; border-bottom: 1px solid rgba(196, 181, 253, 0.2) !important; padding: 1.25rem 1.5rem !important;
}
:deep(.glass-dialog .p-dialog-title) { font-size: 1.1rem !important; font-weight: 700 !important; color: #4c1d95 !important; }
:deep(.glass-dialog .p-dialog-content) { background: transparent !important; padding: 1.5rem !important; }

.upload-form { display: flex; flex-direction: column; gap: 1.25rem; }

.form-banner-error {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(254, 202, 202, 0.45); border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.875rem;
}

.field { display: flex; flex-direction: column; gap: 0.375rem; }
.field label { font-size: 0.75rem; font-weight: 600; color: #5b21b6; letter-spacing: 0.04em; text-transform: uppercase; }
.req { color: #ef4444; margin-left: 2px; }

/* File drop zone */
.file-drop-zone {
  position: relative; border: 2px dashed rgba(196, 181, 253, 0.5);
  border-radius: 14px; padding: 1.5rem; text-align: center;
  background: rgba(237, 233, 254, 0.2); cursor: pointer; transition: all 0.2s;
}
.file-drop-zone:hover { border-color: #a78bfa; background: rgba(237, 233, 254, 0.35); }
.file-drop-zone--selected { border-color: #86efac; background: rgba(134, 239, 172, 0.1); }

.file-input {
  position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
}

.file-drop-hint { display: flex; flex-direction: column; align-items: center; gap: 0.375rem; color: #7c6fa0; }
.drop-icon { font-size: 1.75rem; color: #a78bfa; }
.drop-limit { font-size: 0.72rem; color: #9ca3af; }

.file-selected { display: flex; align-items: center; gap: 0.625rem; color: #15803d; font-size: 0.875rem; justify-content: center; }
.file-selected .pi { font-size: 1.1rem; }
.file-size-hint { color: #9ca3af; font-size: 0.75rem; }

.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(196, 181, 253, 0.2); }
</style>
