import { computed, ref } from 'vue'
import {
  apiSchedulesGetCollection,
  apiAttendancesGetCollection,
  apiEnrollmentsGetCollection,
  apiAttendancesPost,
  apiAttendancesIdPut,
} from '@/api'
import { ErreurCollection, lireCollectionComplete } from '@/api/collection'
import type { ScheduleScheduleReadUserSummary, AttendanceAttendanceRead, EnrollmentEnrollmentReadUserSummary } from '@/api'

export interface Participant {
  userIri: string
  fullName: string
  attendanceId?: number
  savedStatus?: string
}

/**
 * Feuille de présence d'un créneau.
 *
 * ⚠ CE COMPOSABLE N'A PAS UN PROBLÈME D'AFFICHAGE, IL AVAIT UN DÉFAUT D'ÉCRITURE.
 *
 * Jusqu'au 11 septembre 2026, il lisait `/api/attendances?page=1` (30 lignes sur 93) et
 * `/api/enrollments?page=1` (30 sur 47), puis cherchait dans ces pages la présence déjà
 * enregistrée d'un participant. Absente de la page, elle était réputée INEXISTANTE, et
 * `saveBatch` POSTait : la contrainte `unique_schedule_user_attendance` rejetait alors
 * l'insertion en HTTP 500 — 3 créneaux atteignables, 7 participants chacun. Les 21 feuilles
 * vides sur 24 venaient du même trou, côté inscriptions.
 *
 * Le correctif tient en une phrase : on ne pagine pas une feuille de présence, on la BORNE
 * au créneau et à la session, et on refuse d'écrire tant qu'on n'est pas sûr de l'avoir lue
 * en entier.
 */
export function useAssiduite() {
  const schedules    = ref<ScheduleScheduleReadUserSummary[]>([])
  const attendances  = ref<AttendanceAttendanceRead[]>([])
  const enrollments  = ref<EnrollmentEnrollmentReadUserSummary[]>([])
  const selectedSchedule = ref<ScheduleScheduleReadUserSummary | null>(null)
  const loading             = ref(false)
  const chargementFeuille   = ref(false)
  const error               = ref<string | null>(null)

  /**
   * Feuille tronquée ou illisible : distinct de `error` (chargement des séances) et distinct
   * d'une feuille légitimement vide. Tant qu'il est non nul, l'écriture est INTERDITE.
   */
  const erreurFeuille = ref<string | null>(null)

  /** L'écriture n'est offerte que sur une feuille dont on sait qu'elle est complète. */
  const feuilleEcrivable = computed(() => erreurFeuille.value === null)

  /**
   * ⚠ JETON ANTI-DÉSORDRE — ET ICI IL NE GARDE PAS UN AFFICHAGE, IL GARDE UNE ÉCRITURE.
   *
   * `selectSchedule` pose `selectedSchedule` de façon SYNCHRONE puis attend. Cliquer le
   * créneau A puis le B avant la fin de A laissait `selectedSchedule = B` avec les présences
   * de A : aucune ne correspondait au créneau B, tous les participants paraissaient non
   * renseignés, et la saisie repartait en POST sur des lignes existantes — c'est-à-dire
   * exactement le HTTP 500 que ce lot corrige. La course reproduit le défaut, elle ne se
   * contente pas de l'accompagner.
   */
  let jeton = 0

  // Inscrits actifs de la session + leur présence déjà enregistrée pour ce créneau.
  const participants = computed((): Participant[] => {
    if (!selectedSchedule.value?.id) return []
    const sessionId   = selectedSchedule.value.session?.id
    const scheduleIri = `/api/schedules/${selectedSchedule.value.id}`
    if (!sessionId) return []

    return enrollments.value
      // ⚠ CES DEUX PRÉDICATS SONT REDONDANTS AVEC LE SERVEUR, ET ON LES GARDE. Ils ne
      // peuvent que RETRANCHER, jamais élargir : ils sont le témoin local d'un filtre
      // serveur qui aurait échoué ouvert sur une collection trop petite pour que le
      // contrôle de complétude le détecte. Les deux défenses ne se recouvrent pas.
      .filter((e) => e.session.id === sessionId && e.status === 'active')
      .map((e) => {
        const userIri  = `/api/users/${e.user.id}`
        const existing = attendances.value.find(
          (a) => a.user === userIri && a.schedule === scheduleIri,
        )
        return {
          userIri,
          fullName:     `${e.user.firstName} ${e.user.lastName}`.trim(),
          attendanceId: existing?.id,
          savedStatus:  existing?.status,
        }
      })
  })

  async function fetchSchedules() {
    loading.value = true
    error.value = null
    try {
      // 24 créneaux : sous la page de 30, et la liste de gauche doit tous les montrer.
      const schRes = await apiSchedulesGetCollection({ query: { page: 1 } })
      if (schRes.error) error.value = 'Impossible de charger les séances.'
      else schedules.value = schRes.data ?? []
    } catch {
      error.value = 'Impossible de charger les séances.'
    } finally {
      loading.value = false
    }
  }

  /**
   * ⚠ LES INSCRIPTIONS SE CHARGENT ICI, PLUS AU MONTAGE. La session n'est pas connue tant
   * qu'aucun créneau n'est choisi : les charger plus tôt obligeait à les prendre toutes,
   * donc à en perdre 17 sur 47.
   */
  async function selectSchedule(schedule: ScheduleScheduleReadUserSummary) {
    const moi = ++jeton

    selectedSchedule.value   = schedule
    chargementFeuille.value  = true
    erreurFeuille.value      = null

    const sessionId = schedule.session?.id

    try {
      if (!sessionId || !schedule.id) {
        throw new ErreurCollection('Cette séance n\'est rattachée à aucune session.')
      }

      const [enrRes, attRes] = await Promise.all([
        apiEnrollmentsGetCollection({
          query: { session: String(sessionId), status: 'active' },
          headers: { Accept: 'application/ld+json' },
        }),
        apiAttendancesGetCollection({
          query: { schedule: String(schedule.id) },
          headers: { Accept: 'application/ld+json' },
        }),
      ])

      if (moi !== jeton) return

      if (enrRes.error || attRes.error) {
        throw new ErreurCollection('Le serveur n\'a pas rendu la feuille de présence.')
      }

      // ⚠ LE CONTRÔLE QUI GARDE CE CORRECTIF. `lireCollectionComplete` lève dès que le
      // nombre d'éléments reçus diffère du total annoncé — qu'il s'agisse d'une session de
      // plus de 30 inscrits (la plus grande en compte 8 aujourd'hui, mais rien ne le
      // plafonne) ou d'un filtre ignoré par le serveur (un SearchFilter échoue OUVERT :
      // `?schedule=abc` rend les 93 lignes). Sans lui, ces deux cas ramènent le HTTP 500.
      const inscrits = lireCollectionComplete<EnrollmentEnrollmentReadUserSummary>(
        enrRes.data, 'Inscriptions de la session',
      )
      const presences = lireCollectionComplete<AttendanceAttendanceRead>(
        attRes.data, 'Présences de la séance',
      )

      if (moi !== jeton) return

      enrollments.value = inscrits
      attendances.value = presences
    } catch (err) {
      if (moi !== jeton) return

      // ⚠ FAIL CLOSED. On ne montre PAS une feuille partielle : l'écran afficherait des
      // participants « non renseignés » qui ne le sont pas, et la moindre saisie écrirait
      // par-dessus. Mieux vaut ne rien montrer et le dire.
      enrollments.value = []
      attendances.value = []
      erreurFeuille.value = err instanceof ErreurCollection
        ? `${err.message} L'enregistrement est désactivé pour cette séance.`
        : 'Impossible de charger la feuille de présence. L\'enregistrement est désactivé.'
    } finally {
      if (moi === jeton) chargementFeuille.value = false
    }
  }

  /**
   * Enregistre les modifications (POST pour une nouvelle présence, PUT pour une existante).
   *
   * ⚠ LE REFUS EN TÊTE N'EST PAS UNE CEINTURE DE BRETELLES. Le `catch` ci-dessous a avalé ce
   * défaut depuis le premier jour : un 500 par participant y devenait « 7 erreur(s) », une
   * phrase indiscernable d'une coupure réseau. La décision de ne pas écrire se prend AVANT
   * la boucle, sur ce que le chargement a établi.
   */
  async function saveBatch(
    localStatuses: Map<string, string>,
  ): Promise<{ saved: number; errors: number; refuse?: string }> {
    if (!selectedSchedule.value?.id) return { saved: 0, errors: 0 }
    if (erreurFeuille.value !== null) {
      return { saved: 0, errors: 0, refuse: erreurFeuille.value }
    }

    const scheduleIri = `/api/schedules/${selectedSchedule.value.id}`
    let saved = 0, errors = 0

    await Promise.allSettled(
      [...localStatuses.entries()].map(async ([userIri, status]) => {
        const existing = attendances.value.find(
          (a) => a.user === userIri && a.schedule === scheduleIri,
        )
        try {
          if (existing?.id) {
            const { data } = await apiAttendancesIdPut({
              path: { id: String(existing.id) },
              body: { status, schedule: scheduleIri, user: userIri },
            })
            if (data) {
              const idx = attendances.value.findIndex((a) => a.id === existing.id)
              if (idx !== -1) attendances.value[idx] = data
            }
          } else {
            const { data } = await apiAttendancesPost({
              body: { status, schedule: scheduleIri, user: userIri },
            })
            if (data) attendances.value.push(data)
          }
          saved++
        } catch {
          errors++
        }
      }),
    )
    return { saved, errors }
  }

  return {
    schedules,
    participants,
    selectedSchedule,
    loading,
    chargementFeuille,
    error,
    erreurFeuille,
    feuilleEcrivable,
    fetchSchedules,
    selectSchedule,
    saveBatch,
  }
}
