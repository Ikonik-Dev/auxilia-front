import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Chantier A4 — `/inscriptions` lit la collection entière, ou rien (16 septembre 2026).
 *
 * ⚠ LES CHIFFRES DE CES TESTS SONT CEUX DE LA DÉMONSTRATION : 47 inscriptions, dont 30 seulement
 * arrivaient dans la page 1 avant ce lot.
 */

const apiEnrollmentsGetCollection = vi.fn()
const apiEnrollmentsPost          = vi.fn()
const apiEnrollmentsIdPut         = vi.fn()

vi.mock('@/api', () => ({
  apiEnrollmentsGetCollection: (...a: unknown[]) => apiEnrollmentsGetCollection(...a),
  apiEnrollmentsPost:          (...a: unknown[]) => apiEnrollmentsPost(...a),
  apiEnrollmentsIdPut:         (...a: unknown[]) => apiEnrollmentsIdPut(...a),
  apiEnrollmentsIdDelete:      vi.fn(),
}))

import {
  EchecInscription,
  TYPE_INSCRIPTION_EN_DOUBLE,
  TYPE_SESSION_COMPLETE,
  echecInscription,
  useInscriptions,
} from '@/composables/useInscriptions'

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

// ══ Chantier A6 — traduire l'échec d'une écriture (16 septembre 2026) ═══════════════════════
//
// Avant ce lot, seule la chaîne '422' recevait un message — « Capacité maximale atteinte », sur
// une erreur de VALIDATION. Le 409 de capacité et le 500 du doublon affichaient « Une erreur est
// survenue. ». Chaque ligne ci-dessous est une réponse que le serveur rend réellement.

describe("echecInscription — une réponse, un motif juste", () => {
  const probleme = (type: string) => ({ type, title: "x", status: 409, detail: "x" })

  it.each([
    ["400 — stagiaire ou session disparu", 400, { type: "/errors/400" }, "Ce stagiaire ou cette session n'existe plus.", true],
    ["409 — doublon", 409, probleme(TYPE_INSCRIPTION_EN_DOUBLE), "Ce stagiaire est déjà inscrit à cette session.", true],
    ["409 — session complète", 409, probleme(TYPE_SESSION_COMPLETE), "Cette session est complète.", false],
    ["409 — type inconnu : message générique, JAMAIS le motif d'un autre conflit", 409, probleme("urn:autre"), "L'inscription est en conflit avec l'état actuel.", true],
    ["422 — validation", 422, { type: "/validation_errors/x" }, "Inscription incomplète : choisissez un stagiaire et une session.", false],
    ["429 — débit", 429, { type: "/errors/429" }, "Trop d'inscriptions en peu de temps. Réessayez dans une minute.", false],
    ["500 — ne dit pas « non créée », relit la liste", 500, { type: "/errors/500" }, "Erreur du serveur. L'inscription a pu être enregistrée : vérifiez la liste avant de réessayer.", true],
    ["pas de réponse (réseau)", undefined, "Failed to fetch", "Le serveur n'a pas répondu. Vérifiez la liste avant de réessayer.", true],
  ] as const)("%s", (_nom, statut, corps, message, relire) => {
    const echec = echecInscription(statut, corps)

    expect(echec).toBeInstanceOf(EchecInscription)
    expect(echec.message).toBe(message)
    expect(echec.relireLaListe).toBe(relire)
  })

  // ⚠ LA MOITIÉ FRONT DE « message de capacité SOLDÉ » : une session complète (409 +
  // TYPE_SESSION_COMPLETE, asserté côté serveur par EnrollmentProcessorTest) affiche son motif.
  it("affiche « Cette session est complète. » sur le 409 de capacité — et plus jamais « Une erreur est survenue. »", () => {
    expect(echecInscription(409, probleme(TYPE_SESSION_COMPLETE)).message).toBe("Cette session est complète.")
  })

  it("ne lit JAMAIS detail : un detail qui ressemble à un doublon ne fait pas un doublon", () => {
    const corps = { type: "urn:autre", detail: "Ce stagiaire est déjà inscrit à cette session." }

    expect(echecInscription(409, corps).message).toBe("L'inscription est en conflit avec l'état actuel.")
  })
})

describe("createInscription — le code vient de response.status, le motif de type", () => {
  beforeEach(() => vi.clearAllMocks())

  it("se fie au statut HTTP même si le corps porte un autre status", async () => {
    apiEnrollmentsPost.mockResolvedValue({
      data: undefined,
      // Un corps qui MENTIRAIT sur son statut : avant A6, le front aurait lu ce 422.
      error: { type: TYPE_INSCRIPTION_EN_DOUBLE, status: 422 },
      response: { status: 409 },
    })

    const erreur = await useInscriptions().createInscription({} as never).catch((e: unknown) => e)

    expect(erreur).toBeInstanceOf(EchecInscription)
    expect((erreur as EchecInscription).message).toBe("Ce stagiaire est déjà inscrit à cette session.")
  })

  it("rend l'inscription créée sur un 201", async () => {
    apiEnrollmentsPost.mockResolvedValue({ data: { id: 2759 }, error: undefined, response: { status: 201 } })

    await expect(useInscriptions().createInscription({} as never)).resolves.toEqual({ id: 2759 })
  })

  it("validateInscription (PUT) passe par la même traduction : plus de « Capacité » sur un 422", async () => {
    apiEnrollmentsIdPut.mockResolvedValue({ data: undefined, error: { type: "/validation_errors/x" }, response: { status: 422 } })

    const inscription = { id: 1, user: { id: 1 }, session: { id: 1 }, progressPercentage: "0", certificateIssued: false } as never
    const erreur = await useInscriptions().validateInscription(inscription).catch((e: unknown) => e)

    expect((erreur as EchecInscription).message).not.toContain("Capacité")
    expect((erreur as EchecInscription).message).toBe("Inscription incomplète : choisissez un stagiaire et une session.")
  })
})
