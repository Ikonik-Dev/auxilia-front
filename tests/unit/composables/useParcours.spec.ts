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
