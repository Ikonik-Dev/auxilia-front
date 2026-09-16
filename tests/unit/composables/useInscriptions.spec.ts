import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Chantier A4 — `/inscriptions` lit la collection entière, ou rien (16 septembre 2026).
 *
 * ⚠ LES CHIFFRES DE CES TESTS SONT CEUX DE LA DÉMONSTRATION : 47 inscriptions, dont 30 seulement
 * arrivaient dans la page 1 avant ce lot.
 */

const apiEnrollmentsGetCollection = vi.fn()

vi.mock('@/api', () => ({
  apiEnrollmentsGetCollection: (...a: unknown[]) => apiEnrollmentsGetCollection(...a),
  apiEnrollmentsPost:          vi.fn(),
  apiEnrollmentsIdPut:         vi.fn(),
  apiEnrollmentsIdDelete:      vi.fn(),
}))

import { useInscriptions } from '@/composables/useInscriptions'

function inscriptions(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, status: 'active' }))
}

/** Une collection `application/ld+json` telle que l'API la rend réellement. */
function ld(membres: unknown[], total = membres.length) {
  return { data: { member: membres, totalItems: total }, error: undefined }
}

describe('useInscriptions — la liste est lue en entier, ou pas du tout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('demande le plafond serveur en JSON-LD, et plus aucune page', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld(inscriptions(47)))

    await useInscriptions().fetchInscriptions()

    expect(apiEnrollmentsGetCollection).toHaveBeenCalledWith({
      query: { itemsPerPage: 100 },
      headers: { Accept: 'application/ld+json' },
    })
  })

  it('rend les 47 inscriptions quand la lecture est complète', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld(inscriptions(47)))

    const { fetchInscriptions, inscriptions: liste, error } = useInscriptions()
    await fetchInscriptions()

    expect(error.value).toBeNull()
    expect(liste.value).toHaveLength(47)
  })

  // ── LE CŒUR DU LOT ─────────────────────────────────────────────────────────────────
  //
  // ⚠ C'est la situation d'avant le lot, telle qu'elle revient si l'attribut
  // `paginationClientItemsPerPage` disparaît d'Enrollment : le paramètre est ignoré, le serveur
  // rend 30 lignes pour 47 annoncées. Supprimer la comparaison de `lireCollectionComplete` fait
  // tomber ce test.

  it('VIDE la liste et lève une alerte sur 30 reçues pour 47 annoncées', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld(inscriptions(30), 47))

    const { fetchInscriptions, inscriptions: liste, error } = useInscriptions()
    await fetchInscriptions()

    expect(liste.value).toEqual([])
    expect(error.value).toContain('30')
    expect(error.value).toContain('47')
  })

  it('NOMME LE SEUIL de 100 quand il y a plus d\'inscriptions que le serveur n\'en rend', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue(ld(inscriptions(100), 101))

    const { fetchInscriptions, inscriptions: liste, error } = useInscriptions()
    await fetchInscriptions()

    expect(liste.value).toEqual([])
    expect(error.value).toContain('101')
    expect(error.value).toContain('100')
    expect(error.value).toContain('ne peut pas les afficher tous')
  })

  it('refuse un tableau nu (en-tête Accept perdu) au lieu d\'afficher une liste vide', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({ data: inscriptions(30), error: undefined })

    const { fetchInscriptions, inscriptions: liste, error } = useInscriptions()
    await fetchInscriptions()

    expect(liste.value).toEqual([])
    expect(error.value).not.toBeNull()
  })

  it('vide la liste quand le serveur rend une erreur', async () => {
    apiEnrollmentsGetCollection.mockResolvedValue({ data: undefined, error: { status: 403 } })

    const { fetchInscriptions, inscriptions: liste, error } = useInscriptions()
    await fetchInscriptions()

    expect(liste.value).toEqual([])
    expect(error.value).not.toBeNull()
  })
})
