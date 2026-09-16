import { ref } from 'vue'
import {
  apiEnrollmentsGetCollection,
  apiEnrollmentsPost,
  apiEnrollmentsIdPut,
  apiEnrollmentsIdDelete,
} from '@/api'
import { ErreurCollection, PLAFOND_ITEMS_PAR_PAGE, lireCollectionSousPlafond } from '@/api/collection'
import { typeDuProbleme } from '@/api/probleme'
import type { EnrollmentEnrollmentReadUserSummary, EnrollmentEnrollmentWrite } from '@/api'

/**
 * `type` RFC 7807 des deux 409 du serveur — MIROIRS de `InscriptionEnDoubleException::TYPE` et
 * `SessionCompleteException::TYPE` (auxilia-api/src/Exception/).
 *
 * ⚠ VALEURS RECOPIÉES, même famille que `PLAFOND_ITEMS_PAR_PAGE`. Si le serveur en change une, le
 * front ne ment pas : un 409 de `type` inconnu reçoit le message de conflit générique, jamais le
 * motif d'un autre conflit. Dette consignée dans ROADMAP.md.
 */
export const TYPE_INSCRIPTION_EN_DOUBLE = 'urn:auxilium:inscription:en-double'
export const TYPE_SESSION_COMPLETE      = 'urn:auxilium:inscription:session-complete'

/** Échec d'écriture d'une inscription : le message à afficher, et s'il faut relire la liste. */
export class EchecInscription extends Error {
  constructor(message: string, readonly relireLaListe: boolean) {
    super(message)
    this.name = 'EchecInscription'
  }
}

/**
 * Traduit une réponse d'échec en message juste (chantier A6, 16 septembre 2026).
 *
 * ⚠ LE CODE SE LIT SUR `response.status`, LE MOTIF SUR `type`, JAMAIS SUR `detail`.
 * Avant ce lot, le front lisait `status` dans le CORPS et n'attendait qu'un 422 : le 409 de la
 * capacité affichait « Une erreur est survenue. », un doublon produisait un 500 non traité, et
 * « Capacité maximale atteinte » était réservé à un 422 — une erreur de VALIDATION.
 *
 * ⚠ UN 500 NE DIT PAS « NON CRÉÉE ». Le processor flushe l'inscription AVANT de créer le Parcours
 * et les LessonCompletion : un 500 levé après ce flush laisse une inscription existante. D'où
 * « a pu être enregistrée » et la relecture de la liste.
 */
export function echecInscription(statut: number | undefined, erreur: unknown): EchecInscription {
  if (statut === undefined) {
    return new EchecInscription('Le serveur n\'a pas répondu. Vérifiez la liste avant de réessayer.', true)
  }
  if (statut === 400) {
    return new EchecInscription('Ce stagiaire ou cette session n\'existe plus.', true)
  }
  if (statut === 409) {
    const type = typeDuProbleme(erreur)
    if (type === TYPE_INSCRIPTION_EN_DOUBLE) {
      return new EchecInscription('Ce stagiaire est déjà inscrit à cette session.', true)
    }
    if (type === TYPE_SESSION_COMPLETE) {
      return new EchecInscription('Cette session est complète.', false)
    }
    return new EchecInscription('L\'inscription est en conflit avec l\'état actuel.', true)
  }
  if (statut === 422) {
    return new EchecInscription('Inscription incomplète : choisissez un stagiaire et une session.', false)
  }
  if (statut === 429) {
    return new EchecInscription('Trop d\'inscriptions en peu de temps. Réessayez dans une minute.', false)
  }
  if (statut >= 500) {
    return new EchecInscription(
      'Erreur du serveur. L\'inscription a pu être enregistrée : vérifiez la liste avant de réessayer.',
      true,
    )
  }
  return new EchecInscription('Impossible d\'enregistrer l\'inscription.', false)
}

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
    const { data, error: apiError, response } = await apiEnrollmentsPost({ body: payload })
    if (apiError || !data) throw echecInscription(response?.status, apiError)
    return data as EnrollmentEnrollmentReadUserSummary
  }

  /**
   * ⚠ LE PUT N'A AUCUN GARDE CÔTÉ SERVEUR — ni doublon, ni capacité : l'opération `Put`
   * d'Enrollment n'a pas de processor. Seul son MESSAGE est corrigé ici (chantier A6) : il
   * affichait « Capacité de la session atteinte » sur un 422, sur un chemin où la capacité n'est
   * jamais vérifiée. Dette 🟠 consignée dans ROADMAP.md.
   */
  async function validateInscription(enrollment: EnrollmentEnrollmentReadUserSummary): Promise<EnrollmentEnrollmentReadUserSummary> {
    const { data, error: apiError, response } = await apiEnrollmentsIdPut({
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
    if (apiError || !data) throw echecInscription(response?.status, apiError)
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
