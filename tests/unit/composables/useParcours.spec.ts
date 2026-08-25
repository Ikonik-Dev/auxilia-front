import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le SDK généré est stubbé : ces tests portent sur la logique de dérivation
// (quels enrollments comptent comme « en cours »), pas sur le réseau.
const apiEnrollmentsGetCollection = vi.fn()
const apiSessionsIdGet = vi.fn()

vi.mock('@/api', () => ({
  apiEnrollmentsGetCollection: (...args: unknown[]) => apiEnrollmentsGetCollection(...args),
  apiSessionsIdGet: (...args: unknown[]) => apiSessionsIdGet(...args),
  apiModulesGetCollection: vi.fn().mockResolvedValue({ data: [] }),
  apiLessonsGetCollection: vi.fn().mockResolvedValue({ data: [] }),
  apiLessonCompletionsGetCollection: vi.fn().mockResolvedValue({ data: [] }),
  apiLessonCompletionsPost: vi.fn(),
  apiLessonCompletionsIdPut: vi.fn(),
  apiParcoursGetCollection: vi.fn().mockResolvedValue({ data: [] }),
  apiMilestonesGetCollection: vi.fn().mockResolvedValue({ data: [] }),
}))

import { useParcours } from '@/composables/useParcours'

/**
 * Fabrique un enrollment minimal. `status` doit rester dans les valeurs réelles
 * du modèle — cf. CLAUDE.md §7 : pending | active | completed | abandoned.
 */
function makeEnrollment(id: number, status: string) {
  return {
    id,
    status,
    progressPercentage: '50.00',
    certificateIssued: false,
    user: { id: 1 },
    session: { id: 100 + id, name: `Session ${id}` },
  }
}

describe('useParcours — activeEnrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiSessionsIdGet.mockResolvedValue({ data: { formation: { id: 1 } } })
  })

  it("ne retient que le statut 'active' parmi les statuts réels du modèle", async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [
        makeEnrollment(1, 'pending'),
        makeEnrollment(2, 'active'),
        makeEnrollment(3, 'completed'),
        makeEnrollment(4, 'abandoned'),
      ],
      error: undefined,
    })

    const { enrollments, activeEnrollments, fetchParcours } = useParcours()
    await fetchParcours()

    expect(enrollments.value).toHaveLength(4)
    expect(activeEnrollments.value.map((e) => e.id)).toEqual([2])
  })

  it("ignore 'in_progress', qui n'existe pas pour un enrollment", async () => {
    // Garde-fou : ce statut a longtemps été filtré à tort ici. Il appartient à
    // LessonCompletion, pas à Enrollment.
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'in_progress')],
      error: undefined,
    })

    const { activeEnrollments, fetchParcours } = useParcours()
    await fetchParcours()

    expect(activeEnrollments.value).toEqual([])
  })

  it('auto-sélectionne quand il y a exactement un enrollment actif', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'completed'), makeEnrollment(2, 'active')],
      error: undefined,
    })

    const { selectedEnrollment, fetchParcours } = useParcours()
    await fetchParcours()

    expect(selectedEnrollment.value?.id).toBe(2)
  })

  it("n'auto-sélectionne pas quand plusieurs enrollments sont actifs", async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'active'), makeEnrollment(2, 'active')],
      error: undefined,
    })

    const { selectedEnrollment, activeEnrollments, fetchParcours } = useParcours()
    await fetchParcours()

    expect(activeEnrollments.value).toHaveLength(2)
    expect(selectedEnrollment.value).toBeNull()
  })

  it('expose les enrollments même quand aucun n\'est actif (rendu de l\'Historique)', async () => {
    // Cas réel des fixtures : un stagiaire dont toutes les inscriptions sont
    // terminées. La page /parcours doit avoir de quoi rendre sa section
    // « Historique » — enrollments non vide, activeEnrollments vide.
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'completed'), makeEnrollment(2, 'completed')],
      error: undefined,
    })

    const { enrollments, activeEnrollments, selectedEnrollment, error, fetchParcours } =
      useParcours()
    await fetchParcours()

    expect(error.value).toBeNull()
    expect(enrollments.value).toHaveLength(2)
    expect(activeEnrollments.value).toEqual([])
    expect(selectedEnrollment.value).toBeNull()
  })
})

describe('useParcours — inactiveEnrollments (historique)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiSessionsIdGet.mockResolvedValue({ data: { formation: { id: 1 } } })
  })

  it("expose l'historique MÊME quand une formation est en cours", async () => {
    // Régression : la section « Historique » de /parcours était conditionnée à
    // `activeEnrollments.length === 0`. Un stagiaire ayant 1 `active` +
    // 1 `completed` — le cas nominal des fixtures — ne voyait jamais sa
    // formation terminée.
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'completed'), makeEnrollment(2, 'active')],
      error: undefined,
    })

    const { inactiveEnrollments, activeEnrollments, fetchParcours } = useParcours()
    await fetchParcours()

    expect(activeEnrollments.value.map((e) => e.id)).toEqual([2])
    expect(inactiveEnrollments.value.map((e) => e.id)).toEqual([1])
  })

  it("n'inclut jamais l'inscription active dans l'historique", async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [
        makeEnrollment(1, 'pending'),
        makeEnrollment(2, 'active'),
        makeEnrollment(3, 'completed'),
        makeEnrollment(4, 'abandoned'),
      ],
      error: undefined,
    })

    const { inactiveEnrollments, fetchParcours } = useParcours()
    await fetchParcours()

    expect(inactiveEnrollments.value.map((e) => e.id)).toEqual([1, 3, 4])
  })
})

describe('useParcours — erreurs de détail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiSessionsIdGet.mockResolvedValue({ data: { formation: { id: 1 } } })
  })

  it('signale explicitement une session sans formation rattachée', async () => {
    // Auparavant : `return` muet, la page retombait sur « Aucun module
    // disponible » et masquait la vraie cause.
    apiSessionsIdGet.mockResolvedValue({ data: { formation: null } })
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'active')],
      error: undefined,
    })

    const { detailError, error, selectedEnrollment, fetchParcours } = useParcours()
    await fetchParcours()

    expect(selectedEnrollment.value?.id).toBe(1)
    expect(detailError.value).toMatch(/aucune formation/i)
    // L'erreur de détail ne doit pas masquer la page entière.
    expect(error.value).toBeNull()
  })

  it('signale explicitement une inscription sans session', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [{ ...makeEnrollment(1, 'active'), session: { id: null, name: 'Sans session' } }],
      error: undefined,
    })

    const { detailError, error, fetchParcours } = useParcours()
    await fetchParcours()

    expect(detailError.value).toMatch(/aucune session/i)
    expect(error.value).toBeNull()
  })

  it("un échec de chargement du détail n'efface pas la liste des inscriptions", async () => {
    apiSessionsIdGet.mockRejectedValue(new Error('réseau'))
    apiEnrollmentsGetCollection.mockResolvedValue({
      data: [makeEnrollment(1, 'active'), makeEnrollment(2, 'completed')],
      error: undefined,
    })

    const { enrollments, detailError, error, fetchParcours } = useParcours()
    await fetchParcours()

    expect(detailError.value).toMatch(/détail/i)
    expect(error.value).toBeNull()
    expect(enrollments.value).toHaveLength(2)
  })
})
