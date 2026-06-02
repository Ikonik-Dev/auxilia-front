import { ref } from 'vue'
import { apiDocumentsGetCollection, apiDocumentDownloadsPost } from '@/api'
import type { DocumentDocumentRead } from '@/api'

const API_BASE = 'http://localhost:8080'

export function useDocuments() {
  const documents = ref<DocumentDocumentRead[]>([])
  const loading   = ref(false)
  const error     = ref<string | null>(null)

  async function fetchDocuments(page = 1) {
    loading.value = true
    error.value   = null
    try {
      const { data, error: apiError } = await apiDocumentsGetCollection({ query: { page } })
      if (apiError) error.value = 'Impossible de charger les documents.'
      else documents.value = data ?? []
    } catch {
      error.value = 'Impossible de charger les documents.'
    } finally {
      loading.value = false
    }
  }

  async function downloadDocument(doc: DocumentDocumentRead): Promise<void> {
    if (!doc.id) return
    // Enregistre le téléchargement
    await apiDocumentDownloadsPost({
      body: { document: `/api/documents/${doc.id}` },
    }).catch(() => {/* silencieux — on ouvre quand même */})
    // Ouvre le fichier (servi par contrôleur dédié backend)
    window.open(`${API_BASE}/${doc.filePath}`, '_blank', 'noopener')
  }

  async function uploadDocument(formData: FormData): Promise<DocumentDocumentRead> {
    const response = await fetch(`${API_BASE}/api/documents`, {
      method:      'POST',
      credentials: 'include',
      body:        formData,
    })
    if (!response.ok) {
      const json = await response.json().catch(() => ({}))
      throw new Error(json?.detail ?? `Erreur ${response.status}`)
    }
    return response.json() as Promise<DocumentDocumentRead>
  }

  return { documents, loading, error, fetchDocuments, downloadDocument, uploadDocument }
}
