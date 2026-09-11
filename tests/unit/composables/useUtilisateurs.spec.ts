import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le SDK généré est stubbé : ces tests portent sur le contrat d'appel (quel verbe, quelle
// charge utile) et sur la remontée du motif d'erreur, pas sur le réseau.
const apiUsersIdPatch = vi.fn()
const apiUsersIdPut = vi.fn()
const apiUsersPost = vi.fn()
const apiUsersGetCollection = vi.fn()

vi.mock('@/api', () => ({
  apiUsersGetCollection: (...args: unknown[]) => apiUsersGetCollection(...args),
  apiUsersPost: (...args: unknown[]) => apiUsersPost(...args),
  apiUsersIdPatch: (...args: unknown[]) => apiUsersIdPatch(...args),
  apiUsersIdDelete: vi.fn().mockResolvedValue({ error: undefined }),
}))

/** Une collection `application/ld+json` telle que l'API la rend réellement. */
function collectionLd(nombre: number, total = nombre) {
  return {
    data: {
      member: Array.from({ length: nombre }, (_, i) => ({ id: i + 1, email: `u${i}@test.local` })),
      totalItems: total,
    },
    error: undefined,
  }
}

import { useUtilisateurs } from '@/composables/useUtilisateurs'

describe('useUtilisateurs — édition', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiUsersIdPatch.mockResolvedValue({ data: { id: 7, firstName: 'Edite' }, error: undefined })
  })

  it('édite via PATCH, jamais via PUT', async () => {
    const { updateUser } = useUtilisateurs()
    await updateUser(7, { firstName: 'Edite' })

    expect(apiUsersIdPatch).toHaveBeenCalledTimes(1)
    expect(apiUsersIdPut).not.toHaveBeenCalled()
    expect(apiUsersIdPatch).toHaveBeenCalledWith({
      path: { id: '7' },
      body: { firstName: 'Edite' },
    })
  })

  /**
   * Le cœur du bug du 25 août 2026 : un mot de passe absent doit rester ABSENT de la
   * charge utile. Une clé `plainPassword: ''` ferait échouer PasswordStrength (score 0),
   * et une clé `null` écraserait le hash côté serveur.
   */
  it("n'envoie aucune clé plainPassword quand le champ est laissé vide", async () => {
    const { updateUser } = useUtilisateurs()
    await updateUser(7, { email: 'inchange@test.local', firstName: 'Edite' })

    const corps = apiUsersIdPatch.mock.calls[0]?.[0]?.body as Record<string, unknown>
    expect(corps).not.toHaveProperty('plainPassword')
    expect(corps.email).toBe('inchange@test.local')
  })

  it('transmet plainPassword quand un nouveau mot de passe est saisi', async () => {
    const { updateUser } = useUtilisateurs()
    await updateUser(7, { plainPassword: 'Qz7!yR4@bN3#kX9' })

    const corps = apiUsersIdPatch.mock.calls[0]?.[0]?.body as Record<string, unknown>
    expect(corps.plainPassword).toBe('Qz7!yR4@bN3#kX9')
  })

  it('remonte le motif de la violation plutôt qu\'un message générique', async () => {
    apiUsersIdPatch.mockResolvedValue({
      data: undefined,
      error: {
        violations: [{ propertyPath: 'email', message: 'Cette adresse email est déjà utilisée.' }],
      },
    })

    const { updateUser } = useUtilisateurs()
    await expect(updateUser(7, { email: 'pris@test.local' })).rejects.toThrow(
      'Cette adresse email est déjà utilisée.',
    )
  })

  it('remonte le detail d\'un refus de droits', async () => {
    apiUsersIdPatch.mockResolvedValue({
      data: undefined,
      // Fixture alignée le 9 septembre 2026 sur le message réellement émis par
      // `UserStateProcessor` depuis le commit backend 7cc8e48 (anti-escalade par plafond).
      // ⚠ Ce test passait déjà et continuera de passer : il assertit `toThrow('Accès
      // refusé')`, préfixe commun à l'ancien message et au nouveau. Ce n'était donc pas un
      // test faux, mais une fixture documentant une phrase que le code n'émet plus.
      error: {
        detail:
          'Accès refusé : vous ne pouvez pas modifier les rôles de ce compte — '
          + 'le rôle « ROLE_ADMIN » dépasse votre plafond de gestion.',
      },
    })

    const { updateUser } = useUtilisateurs()
    await expect(updateUser(7, { roles: ['ROLE_ADMIN'] })).rejects.toThrow('Accès refusé')
  })

  it('retombe sur un message générique quand le corps d\'erreur est inexploitable', async () => {
    apiUsersIdPatch.mockResolvedValue({ data: undefined, error: {} })

    const { updateUser } = useUtilisateurs()
    await expect(updateUser(7, { firstName: 'X' })).rejects.toThrow(
      'Impossible de modifier l\'utilisateur.',
    )
  })
})

/**
 * Chantier A — la collection paginée côté serveur (11 septembre 2026).
 *
 * ⚠ CES TESTS EXISTENT PARCE QUE `vue-tsc` NE PEUT RIEN VOIR ICI. Le SDK généré déclare
 * `ApiUsersGetCollectionResponses = { 200: Array<UserUserRead> }` — inconditionnellement,
 * quel que soit l'en-tête `Accept`. Demander du `ld+json` change la forme réelle de la
 * réponse sans changer son type : le type ment, il n'échoue pas. Le compilateur laisserait
 * donc passer une régression qui viderait l'écran. Ces tests sont le seul filet.
 */
describe('useUtilisateurs — collection paginée', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiUsersGetCollection.mockResolvedValue(collectionLd(30, 53))
  })

  it('demande explicitement la forme ld+json, seule à porter totalItems', async () => {
    const { fetchUtilisateurs } = useUtilisateurs()
    await fetchUtilisateurs()

    const appel = apiUsersGetCollection.mock.calls[0]?.[0] as { headers?: Record<string, string> }
    expect(appel.headers?.Accept).toBe('application/ld+json')
  })

  it('déplie member et totalItems', async () => {
    const { utilisateurs, total, fetchUtilisateurs } = useUtilisateurs()
    await fetchUtilisateurs()

    expect(utilisateurs.value).toHaveLength(30)
    expect(total.value).toBe(53)
  })

  /**
   * La garde d'exécution. Si quelqu'un retire l'en-tête `Accept` — ou le pose globalement
   * dans `client.ts`, ce qui reviendrait au même pour les onze autres composables — l'API
   * rend un TABLEAU NU. Sans cette garde, l'écran afficherait une liste vide en silence.
   */
  it('signale une réponse de forme inattendue au lieu d\'afficher une liste vide', async () => {
    apiUsersGetCollection.mockResolvedValue({ data: [{ id: 1 }], error: undefined })

    const { utilisateurs, error, fetchUtilisateurs } = useUtilisateurs()
    await fetchUtilisateurs()

    expect(error.value).toMatch(/format de collection/)
    expect(utilisateurs.value).toHaveLength(0)
  })

  /**
   * ⚠ LE TEST QUI PORTE LE JETON. Le debounce espace les requêtes, il ne les ordonne pas :
   * une recherche « ben » lente et une recherche « benali » rapide peuvent revenir dans cet
   * ordre. Sans le jeton, l'écran afficherait les résultats de « ben » — et SON total — sous
   * un champ affichant « benali ».
   */
  it('ignore une réponse périmée revenue après une plus récente', async () => {
    let resoudreLaLente: (v: unknown) => void = () => {}
    const lente = new Promise((resoudre) => { resoudreLaLente = resoudre })

    apiUsersGetCollection
      .mockReturnValueOnce(lente)                       // partie en 1re, reviendra en 2e
      .mockResolvedValueOnce(collectionLd(1, 1))        // partie en 2e, revient tout de suite

    const { total, loading, fetchUtilisateurs } = useUtilisateurs()

    const perimee = fetchUtilisateurs({ q: 'ben' })
    await fetchUtilisateurs({ q: 'benali' })

    expect(total.value).toBe(1)

    resoudreLaLente(collectionLd(30, 41))
    await perimee

    expect(total.value).toBe(1)
    expect(loading.value).toBe(false)
  })

  it('n\'envoie que les filtres réellement renseignés', async () => {
    const { fetchUtilisateurs } = useUtilisateurs()
    await fetchUtilisateurs({ page: 2, itemsPerPage: 20, q: '', roles: undefined, isActive: false })

    const query = (apiUsersGetCollection.mock.calls[0]?.[0] as { query: Record<string, unknown> }).query
    expect(query).toEqual({ page: 2, itemsPerPage: 20, isActive: false })
    expect(query).not.toHaveProperty('q')
    expect(query).not.toHaveProperty('roles')
  })
})
