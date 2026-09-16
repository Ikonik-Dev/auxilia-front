import { ref } from 'vue'
import {
  apiEnrollmentsGetCollection,
  apiEnrollmentsPost,
  apiEnrollmentsIdPut,
  apiEnrollmentsIdDelete,
} from '@/api'
import { ErreurCollection, PLAFOND_ITEMS_PAR_PAGE, lireCollectionSousPlafond } from '@/api/collection'
import type { EnrollmentEnrollmentReadUserSummary, EnrollmentEnrollmentWrite } from '@/api'

/**
 * Inscriptions.
 *
 * ⚠ CET ÉCRAN AFFICHAIT 30 INSCRIPTIONS SUR 47, SANS LE DIRE (chantier A4, 16 septembre 2026).
 * `fetchInscriptions` lisait la page 1 de `/api/enrollments` ; la `DataTable` paginait ensuite
 * côté client ces 30 lignes comme si elles étaient tout. La recherche, le filtre de statut et le
 * compteur « en attente » portaient sur la même page.
 *
 * Aucune écriture n'en dépendait — valider et supprimer prennent l'identifiant de la ligne
 * cliquée —, d'où un correctif de LECTURE : la collection est lue entière, ou pas du tout.
 */
export function useInscriptions() {
  const inscriptions = ref<EnrollmentEnrollmentReadUserSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * ⚠ LE PARAMÈTRE `page` A ÉTÉ RETIRÉ, DÉLIBÉRÉMENT — comme dans `useEvaluations`. Le garder
   * inviterait à repaginer une collection qu'on a décidé de lire entière.
   *
   * ⚠ `itemsPerPage` N'A D'EFFET QUE PARCE QU'`Enrollment` DÉCLARE
   * `paginationClientItemsPerPage: true`. Sans cet attribut, le serveur l'ignore en silence et
   * rend 30 lignes : `lireCollectionSousPlafond` lève alors, et l'écran affiche une alerte au lieu
   * d'une liste fausse.
   */
  async function fetchInscriptions() {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiEnrollmentsGetCollection({
        query: { itemsPerPage: PLAFOND_ITEMS_PAR_PAGE },
        headers: { Accept: 'application/ld+json' },
      })
      if (apiError) throw new ErreurCollection("Le serveur n'a pas rendu la liste des inscriptions.")

      inscriptions.value = lireCollectionSousPlafond<EnrollmentEnrollmentReadUserSummary>(
        data, 'Inscriptions',
      )
    } catch (e) {
      // ⚠ FAIL CLOSED. Une liste partielle affichée comme entière est le défaut corrigé : on vide.
      // Le compteur « en attente » tombe à 0 et son badge disparaît — il ne s'affiche pas à côté
      // d'une alerte qui dit qu'on ne sait pas.
      inscriptions.value = []
      error.value = e instanceof ErreurCollection
        ? e.message
        : 'Impossible de charger les inscriptions.'
    } finally {
      loading.value = false
    }
  }

  async function createInscription(payload: EnrollmentEnrollmentWrite): Promise<EnrollmentEnrollmentReadUserSummary> {
    const { data, error: apiError } = await apiEnrollmentsPost({ body: payload })
    if (apiError || !data) {
      const status = (apiError as { status?: number } | null)?.status
      if (status === 422) throw new Error('422')
      throw new Error('Impossible de créer l\'inscription.')
    }
    return data as EnrollmentEnrollmentReadUserSummary
  }

  async function validateInscription(enrollment: EnrollmentEnrollmentReadUserSummary): Promise<EnrollmentEnrollmentReadUserSummary> {
    const { data, error: apiError } = await apiEnrollmentsIdPut({
      path: { id: String(enrollment.id) },
      body: {
        status: 'active',
        progressPercentage: enrollment.progressPercentage,
        certificateIssued: enrollment.certificateIssued,
        user: `/api/users/${enrollment.user.id}`,
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
    return data as EnrollmentEnrollmentReadUserSummary
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
