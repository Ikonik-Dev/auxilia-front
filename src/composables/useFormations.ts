import { ref } from 'vue'
import {
  apiFormationsGetCollection,
  apiFormationsIdGet,
  apiFormationsPost,
  apiFormationsIdPatch,
  apiFormationsIdDelete,
} from '@/api'
import type {
  FormationFormationRead,
  FormationFormationWrite,
  FormationFormationWriteJsonMergePatch,
} from '@/api'

export function useFormations() {
  const formations = ref<FormationFormationRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchFormations(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiFormationsGetCollection({ query: { page } })
      if (apiError) error.value = 'Impossible de charger les formations.'
      else formations.value = data ?? []
    } catch {
      error.value = 'Impossible de charger les formations.'
    } finally {
      loading.value = false
    }
  }

  async function fetchFormation(id: string | number): Promise<FormationFormationRead | null> {
    const { data, error: apiError } = await apiFormationsIdGet({ path: { id: String(id) } })
    if (apiError) return null
    return data ?? null
  }

  async function createFormation(payload: FormationFormationWrite): Promise<FormationFormationRead> {
    const { data, error: apiError } = await apiFormationsPost({ body: payload })
    if (apiError || !data) throw new Error('Impossible de créer la formation.')
    return data
  }

  async function updateFormation(
    id: string | number,
    payload: FormationFormationWriteJsonMergePatch,
  ): Promise<FormationFormationRead> {
    const { data, error: apiError } = await apiFormationsIdPatch({
      path: { id: String(id) },
      body: payload,
    })
    if (apiError || !data) throw new Error('Impossible de modifier la formation.')
    return data
  }

  async function deleteFormation(id: string | number): Promise<boolean> {
    const { error: apiError } = await apiFormationsIdDelete({ path: { id: String(id) } })
    return !apiError
  }

  return {
    formations,
    loading,
    error,
    fetchFormations,
    fetchFormation,
    createFormation,
    updateFormation,
    deleteFormation,
  }
}
