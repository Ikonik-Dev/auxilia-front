import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'

// Le SDK généré est stubbé : ces tests portent sur le contrat d'appel (quels paramètres de
// filtre partent) et sur le REFUS D'ÉCRIRE quand la lecture est incomplète — pas sur le réseau.
const apiSchedulesGetCollection   = vi.fn()
const apiAttendancesGetCollection = vi.fn()
const apiEnrollmentsGetCollection = vi.fn()
const apiAttendancesPost          = vi.fn()
const apiAttendancesIdPut         = vi.fn()

vi.mock('@/api', () => ({
  apiSchedulesGetCollection:   (...a: unknown[]) => apiSchedulesGetCollection(...a),
  apiAttendancesGetCollection: (...a: unknown[]) => apiAttendancesGetCollection(...a),
  apiEnrollmentsGetCollection: (...a: unknown[]) => apiEnrollmentsGetCollection(...a),
  apiAttendancesPost:          (...a: unknown[]) => apiAttendancesPost(...a),
  apiAttendancesIdPut:         (...a: unknown[]) => apiAttendancesIdPut(...a),
}))

import { useAssiduite } from '@/composables/useAssiduite'

const CRENEAU = { id: 1254, session: { id: 1832 } } as never

/** Une collection `application/ld+json` telle que l'API la rend réellement. */
function ld(membres: unknown[], total = membres.length) {
  return { data: { member: membres, totalItems: total }, error: undefined }
}

function inscription(userId: number) {
  return {
    id: userId,
    status: 'active',
    session: { id: 1832 },
    user: { id: userId, firstName: 'Sta', lastName: `G${userId}` },
  }
}

describe('useAssiduite — feuille de présence bornée au créneau', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiSchedulesGetCollection.mockResolvedValue({ data: [], error: undefined })
  })

  it('borne les deux collections par session et par créneau, jamais par page', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld([inscription(1)]))
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule } = useAssiduite()
    await selectSchedule(CRENEAU)

    expect(apiEnrollmentsGetCollection).toHaveBeenCalledWith({
      query: { session: '1832', status: 'active' },
      headers: { Accept: 'application/ld+json' },
    })
    expect(apiAttendancesGetCollection).toHaveBeenCalledWith({
      query: { schedule: '1254' },
      headers: { Accept: 'application/ld+json' },
    })
  })

  it('rend la feuille écrivable quand les deux collections sont complètes', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld([inscription(1), inscription(2)]))
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule, participants, erreurFeuille, feuilleEcrivable } = useAssiduite()
    await selectSchedule(CRENEAU)

    expect(erreurFeuille.value).toBeNull()
    expect(feuilleEcrivable.value).toBe(true)
    expect(participants.value).toHaveLength(2)
  })

  // ── LE CŒUR DU LOT ───────────────────────────────────────────────────────────────────
  //
  // ⚠ CES DEUX TESTS SONT CE QUI GARDE LE CORRECTIF. Forcer `membres.length === total` à
  // true dans `lireCollectionComplete` les fait tomber tous les deux : c'est la mutation qui
  // établit que la défense défend quelque chose.

  it('BLOQUE l\'écriture quand la collection reçue est tronquée', async () => {
    // 30 inscriptions reçues, 47 annoncées : exactement ce que produisait `?page=1`.
    const recues = Array.from({ length: 30 }, (_, i) => inscription(i + 1))
    apiEnrollmentsGetCollection.mockResolvedValue(ld(recues, 47))
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule, participants, erreurFeuille, feuilleEcrivable } = useAssiduite()
    await selectSchedule(CRENEAU)

    expect(feuilleEcrivable.value).toBe(false)
    expect(erreurFeuille.value).toContain('30')
    expect(erreurFeuille.value).toContain('47')

    // ⚠ ET LA FEUILLE N'EST PAS AFFICHÉE PARTIELLEMENT. Montrer 30 participants « non
    // renseignés » invite à les saisir, donc à écrire par-dessus des lignes existantes.
    expect(participants.value).toHaveLength(0)
  })

  it('REFUSE le batch sur une feuille tronquée, sans émettre un seul POST', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld([inscription(1)], 47))
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule, saveBatch } = useAssiduite()
    await selectSchedule(CRENEAU)

    const bilan = await saveBatch(new Map([['/api/users/1', 'present']]))

    expect(apiAttendancesPost).not.toHaveBeenCalled()
    expect(apiAttendancesIdPut).not.toHaveBeenCalled()
    expect(bilan.saved).toBe(0)
    expect(bilan.refuse).toBeTruthy()
  })

  it('BLOQUE aussi quand le serveur rend un tableau nu (Accept mal posé)', async () => {
    // Le filet de `lireCollectionLd` : sans `totalItems`, on ne sait rien de la complétude.
    apiEnrollmentsGetCollection.mockResolvedValue({ data: [inscription(1)], error: undefined })
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule, feuilleEcrivable, erreurFeuille } = useAssiduite()
    await selectSchedule(CRENEAU)

    expect(feuilleEcrivable.value).toBe(false)
    expect(erreurFeuille.value).toContain('format de collection')
  })

  // ── Le jeton, et ici il garde une ÉCRITURE ───────────────────────────────────────────

  it('ignore la réponse d\'un créneau abandonné, même si elle arrive en dernier', async () => {
    const autre = { id: 1255, session: { id: 1832 } } as never

    let libereA: (v: unknown) => void = () => {}
    const lente = new Promise((r) => { libereA = r })

    // Créneau A : sa réponse arrivera APRÈS celle de B.
    apiEnrollmentsGetCollection.mockReturnValueOnce(lente)
    apiAttendancesGetCollection.mockReturnValueOnce(lente)
    // Créneau B : immédiat.
    apiEnrollmentsGetCollection.mockResolvedValue(ld([inscription(9)]))
    apiAttendancesGetCollection.mockResolvedValue(ld([]))

    const { selectSchedule, participants, selectedSchedule } = useAssiduite()

    const attenteA = selectSchedule(CRENEAU)
    await selectSchedule(autre)

    libereA(ld([inscription(1), inscription(2), inscription(3)]))
    await attenteA
    await nextTick()

    // Si le jeton manquait, les inscrits de A écraseraient ceux de B : les participants
    // paraîtraient non renseignés sur B, et la saisie repartirait en POST sur des lignes
    // existantes — le HTTP 500 que ce lot corrige.
    expect(selectedSchedule.value?.id).toBe(1255)
    expect(participants.value).toHaveLength(1)
  })
})
