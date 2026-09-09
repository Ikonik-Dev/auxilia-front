import { describe, it, expect, vi, beforeEach } from 'vitest'

// Le SDK généré est stubbé : ces tests portent sur le contrat d'appel (quel verbe, quelle
// charge utile) et sur la remontée du motif d'erreur, pas sur le réseau.
const apiUsersIdPatch = vi.fn()
const apiUsersIdPut = vi.fn()
const apiUsersPost = vi.fn()

vi.mock('@/api', () => ({
  apiUsersGetCollection: vi.fn().mockResolvedValue({ data: [] }),
  apiUsersPost: (...args: unknown[]) => apiUsersPost(...args),
  apiUsersIdPatch: (...args: unknown[]) => apiUsersIdPatch(...args),
  apiUsersIdDelete: vi.fn().mockResolvedValue({ error: undefined }),
}))

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
