import { ref } from 'vue'
import { apiDocumentsGetCollection } from '@/api'
import type { DocumentDocumentRead } from '@/api'

export function useDocuments() {
  const documents = ref<DocumentDocumentRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchDocuments(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiDocumentsGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger les documents.'
      } else {
        documents.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les documents.'
    } finally {
      loading.value = false
    }
  }

  return { documents, loading, error, fetchDocuments }
}
