import { ref } from 'vue'
import {
  apiEnrollmentsGetCollection,
  apiEnrollmentsPost,
  apiEnrollmentsIdPut,
  apiEnrollmentsIdDelete,
} from '@/api'
import type { EnrollmentEnrollmentRead, EnrollmentEnrollmentWrite } from '@/api'

export function useInscriptions() {
  const inscriptions = ref<EnrollmentEnrollmentRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchInscriptions(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiEnrollmentsGetCollection({ query: { page } })
      if (apiError) error.value = 'Impossible de charger les inscriptions.'
      else inscriptions.value = data ?? []
    } catch {
      error.value = 'Impossible de charger les inscriptions.'
    } finally {
      loading.value = false
    }
  }

  async function createInscription(payload: EnrollmentEnrollmentWrite): Promise<EnrollmentEnrollmentRead> {
    const { data, error: apiError } = await apiEnrollmentsPost({ body: payload })
    if (apiError || !data) {
      const status = (apiError as { status?: number } | null)?.status
      if (status === 422) throw new Error('422')
      throw new Error('Impossible de créer l\'inscription.')
    }
    return data
  }

  async function validateInscription(enrollment: EnrollmentEnrollmentRead): Promise<EnrollmentEnrollmentRead> {
    const { data, error: apiError } = await apiEnrollmentsIdPut({
      path: { id: String(enrollment.id) },
      body: {
        status: 'active',
        progressPercentage: enrollment.progressPercentage,
        certificateIssued: enrollment.certificateIssued,
        user: enrollment.user,
        session: `/api/sessions/${enrollment.session.id}`,
        enrollmentDate: enrollment.enrollmentDate ?? null,
        startDate: new Date().toISOString(),
        completionDate: null,
        notes: enrollment.notes ?? null,
      },
    })
    if (apiError || !data) {
      const status = (apiError as { status?: number } | null)?.status
      if (status === 422) throw new Error('422')
      throw new Error('Impossible de valider l\'inscription.')
    }
    return data
  }

  async function deleteInscription(id: number): Promise<boolean> {
    const { error: apiError } = await apiEnrollmentsIdDelete({ path: { id: String(id) } })
    return !apiError
  }

  return {
    inscriptions,
    loading,
    error,
    fetchInscriptions,
    createInscription,
    validateInscription,
    deleteInscription,
  }
}
