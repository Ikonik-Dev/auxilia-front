import { computed, ref } from 'vue'
import {
  apiEvaluationsGetCollection,
  apiEvaluationSubmissionsGetCollection,
  apiEvaluationSubmissionsIdgradePatch,
} from '@/api'
import { ErreurCollection, lireCollectionComplete } from '@/api/collection'
import type { EvaluationEvaluationRead, EvaluationSubmissionSubmissionReadUserSummary } from '@/api'

/**
 * Évaluations et file de correction.
 *
 * ⚠ CE COMPOSABLE N'AVAIT PAS UN CHEMIN D'ÉCRITURE CASSÉ — la distinction compte, et elle
 * a décidé du périmètre. `gradeSubmission` prend l'identifiant de la ligne cliquée : il
 * n'interroge aucune liste tronquée pour décider de ce qu'il écrit, contrairement au
 * `saveBatch` de `/assiduite`. Ce qu'il écrit est donc juste.
 *
 * Le défaut était que la file de correction se DÉRIVAIT d'une page : `pendingGrading`
 * filtrait 30 lignes reçues sur 55, et les cinq copies en attente occupaient les rangs
 * 4, 49, 50, 51 et 52 de l'ordre par défaut. Une seule tombait dans la page — le badge
 * annonçait **1 copie à noter pour 5 réelles**, et quatre copies attendaient dans une file
 * que personne ne pouvait atteindre.
 */
export function useEvaluations() {
  const evaluations = ref<EvaluationEvaluationRead[]>([])
  const submissions = ref<EvaluationSubmissionSubmissionReadUserSummary[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Lecture de la file de correction incomplète ou illisible. Distinct de `error`, qui
   * porte l'échec de l'écran entier : tant qu'il est non nul, on ne sait PAS combien de
   * copies attendent, et il est interdit d'écrire « Tout est noté ».
   */
  const erreurCopies = ref<string | null>(null)

  /** Vrai quand la file a été lue en entier, donc quand un tableau vide veut dire zéro. */
  const lectureCopiesReussie = computed(() => erreurCopies.value === null)

  /**
   * ⚠ CE `filter()` RESTE, MÊME AVEC `?status=` CÔTÉ SERVEUR, ET CE N'EST PAS UN DOUBLON.
   * C'est le second témoin : serveur ∧ client est une conjonction, elle ne peut que
   * rétrécir. Il couvre le cas que `lireCollectionComplete` ne voit pas — un filtre
   * ignoré sur une collection dont le total tiendrait sous une page.
   *
   * Quantifié plutôt qu'affirmé : `lireCollectionComplete` suffit tant que la collection
   * non filtrée dépasse 30 (55 aujourd'hui), puisqu'un filtre abandonné rendrait alors
   * 30 membres pour 55 annoncés. Ce `filter()` n'est indispensable que si ce total
   * repassait sous 30. C'est une assurance, pas la défense principale.
   */
  const pendingGrading = computed(() =>
    submissions.value.filter((s) => s.status === 'pending_review'),
  )

  /**
   * ⚠ LE PARAMÈTRE `page` A ÉTÉ RETIRÉ, DÉLIBÉRÉMENT. Il était passé aux DEUX collections
   * à la fois, alors qu'elles ne se paginent pas de la même façon : `/api/evaluations`
   * rend 12 sur 12 et n'a qu'une page. Demander une page 2 aurait vidé le premier onglet
   * pour remplir le second. Le garder inviterait à repaginer la mauvaise table.
   */
  async function fetchEvaluations() {
    loading.value = true
    error.value = null
    erreurCopies.value = null
    try {
      const [evRes, subRes] = await Promise.all([
        // 12 sur 12 — inchangé, et à ne PAS paginer : cf. `getEvalMaxScore` dans la page.
        apiEvaluationsGetCollection({ query: { page: 1 } }),
        // La file de correction est demandée au serveur, plus dérivée d'une page.
        apiEvaluationSubmissionsGetCollection({
          query: { status: 'pending_review' },
          headers: { Accept: 'application/ld+json' },
        }),
      ])

      if (evRes.error) error.value = 'Impossible de charger les évaluations.'
      else evaluations.value = evRes.data ?? []

      try {
        if (subRes.error) {
          throw new ErreurCollection('Le serveur n\'a pas rendu la file de correction.')
        }
        // Lève si le nombre reçu diffère du total annoncé — collection trop grande pour
        // une page, ou filtre abandonné par le serveur.
        submissions.value = lireCollectionComplete<EvaluationSubmissionSubmissionReadUserSummary>(
          subRes.data, 'Copies à noter',
        )
      } catch (err) {
        // ⚠ FAIL CLOSED. On vide plutôt que de montrer une file partielle : une file
        // incomplète invite à la croire terminée, ce qui est exactement le défaut corrigé.
        submissions.value = []
        erreurCopies.value = err instanceof ErreurCollection
          ? `${err.message} Impossible de savoir combien de copies attendent.`
          : 'Impossible de charger la file de correction.'
      }
    } catch {
      error.value = 'Impossible de charger les évaluations.'
    } finally {
      loading.value = false
    }
  }

  async function gradeSubmission(
    id: number,
    score: string,
    feedback: string,
  ): Promise<EvaluationSubmissionSubmissionReadUserSummary> {
    const { data, error: apiError } = await apiEvaluationSubmissionsIdgradePatch({
      path: { id: String(id) },
      body: { score, feedback },
    })
    if (apiError || !data) throw new Error('Impossible d\'enregistrer la note.')
    return data as unknown as EvaluationSubmissionSubmissionReadUserSummary
  }

  return {
    evaluations,
    submissions,
    pendingGrading,
    loading,
    error,
    erreurCopies,
    lectureCopiesReussie,
    fetchEvaluations,
    gradeSubmission,
  }
}
