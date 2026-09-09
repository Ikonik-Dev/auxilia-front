import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import type { UserUserRead } from '@/api'

/**
 * Phase 17 étape 4 — le pendant front de `UserVoterTest`.
 *
 * ⚠ CE FICHIER TESTE UNE COPIE. Les tables de `useUserCapabilities.ts` transcrivent
 * `UserVoter::ACTOR_CEILING` / `TARGET_TIER`, dans un autre dépôt. Aucune porte commune ne
 * confronte les deux : ces tests vérifient que la transcription se comporte comme
 * l'original, ils ne peuvent pas vérifier qu'elle lui est fidèle. C'est la dette 🟡
 * `assignableRoles` de `ROADMAP.md`.
 *
 * Ils restent le contrôle de non-régression du jour où cette copie disparaîtra au profit
 * d'une donnée serveur : ils doivent continuer de passer.
 */

// Le store est simulé : ces tests portent sur la LOGIQUE de capacité, sans Pinia ni DOM.
const mockUser = ref<{ id: number; roles: string[] } | null>(null)

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser.value,
    roles: computed(() => mockUser.value?.roles ?? []).value,
    hasRole: (r: string) => (mockUser.value?.roles ?? []).includes(r),
  }),
}))

const { useUserCapabilities } = await import('@/composables/useUserCapabilities')

/** Connecte un acteur, puis rend ses capacités. */
function connecte(roles: string[], id = 1) {
  mockUser.value = { id, roles: [...roles, 'ROLE_USER'] }
  return useUserCapabilities()
}

/** Une fiche cible minimale — seuls `id` et `roles` comptent pour les capacités. */
function fiche(roles: string[], id: number): UserUserRead {
  return { id, roles: [...roles, 'ROLE_USER'] } as unknown as UserUserRead
}

describe('useUserCapabilities — le tier model côté front', () => {
  beforeEach(() => {
    mockUser.value = null
  })

  // ── 1. Les six plafonds ─────────────────────────────────────────────────────────
  it('rend les six plafonds du modèle', () => {
    const attendu: Array<[string, number]> = [
      ['ROLE_ADMIN', 5],
      ['ROLE_DIRECTEUR', 3],
      ['ROLE_RESPONSABLE_PED', 2],
      ['ROLE_SECRETARIAT', 1],
      ['ROLE_FORMATEUR', 0],
      ['ROLE_USER', 0],
    ]

    for (const [role, plafond] of attendu) {
      expect(connecte([role]).ceiling.value, role).toBe(plafond)
    }
  })

  // ── 2. La porte de la page ──────────────────────────────────────────────────────
  it('ouvre la page aux cinq rôles concernés, et la ferme au stagiaire', () => {
    for (const role of [
      'ROLE_ADMIN',
      'ROLE_DIRECTEUR',
      'ROLE_SECRETARIAT',
      'ROLE_RESPONSABLE_PED',
      'ROLE_FORMATEUR',
    ]) {
      expect(connecte([role]).canOpenPage.value, role).toBe(true)
    }

    // L'API rend 403 à un stagiaire sur GET /api/users : la porte doit dire la même chose.
    expect(connecte(['ROLE_USER']).canOpenPage.value).toBe(false)
  })

  // ── 3. La création — miroir de USER_CREATE sans sujet ───────────────────────────
  it('n\'autorise la création qu\'à partir du plafond 1', () => {
    for (const role of ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED', 'ROLE_SECRETARIAT']) {
      expect(connecte([role]).canCreate.value, role).toBe(true)
    }
    for (const role of ['ROLE_FORMATEUR', 'ROLE_USER']) {
      expect(connecte([role]).canCreate.value, role).toBe(false)
    }
  })

  // ── 4. Édition / suppression, et l'interdit d'auto-suppression ──────────────────
  it('borne l\'édition au plafond, et refuse à chacun de se supprimer', () => {
    const secretariat = connecte(['ROLE_SECRETARIAT'], 48)

    expect(secretariat.canEdit(fiche(['ROLE_USER'], 1))).toBe(true)
    expect(secretariat.canDelete(fiche(['ROLE_USER'], 1))).toBe(true)
    // Le cœur du choix A : le secrétariat s'arrête aux stagiaires.
    expect(secretariat.canEdit(fiche(['ROLE_FORMATEUR'], 42))).toBe(false)
    expect(secretariat.canDelete(fiche(['ROLE_FORMATEUR'], 42))).toBe(false)

    // Choix B : chacun modifie sa fiche, personne ne la supprime — le superviseur compris.
    for (const [role, id] of [
      ['ROLE_ADMIN', 53],
      ['ROLE_DIRECTEUR', 51],
      ['ROLE_RESPONSABLE_PED', 49],
      ['ROLE_SECRETARIAT', 48],
      ['ROLE_FORMATEUR', 42],
    ] as Array<[string, number]>) {
      const moi = connecte([role], id)
      expect(moi.canEdit(fiche([role], id)), `${role} édite sa fiche`).toBe(true)
      expect(moi.canDelete(fiche([role], id)), `${role} ne se supprime pas`).toBe(false)
    }
  })

  // ── 5. Choix C — le formateur consulte, il ne modifie pas ───────────────────────
  it('interdit au formateur de modifier ses stagiaires, mais pas sa propre fiche', () => {
    const formateur = connecte(['ROLE_FORMATEUR'], 42)
    const stagiaire = fiche(['ROLE_USER'], 1)

    // Il le VOIT (le tamis DQL le lui rend), il ne le MODIFIE pas.
    // Mesuré côté API : GET 200 / PATCH 403.
    expect(formateur.canEdit(stagiaire)).toBe(false)
    expect(formateur.canDelete(stagiaire)).toBe(false)
    expect(formateur.canCreate.value).toBe(false)

    expect(formateur.canEdit(fiche(['ROLE_FORMATEUR'], 42))).toBe(true)
  })

  // ── 6. Le piège de l'union ──────────────────────────────────────────────────────
  it('conserve dans les options les rôles que la fiche porte déjà', () => {
    // Un directeur (plafond 3) éditant SA fiche (niveau 4). Sans l'union, ROLE_DIRECTEUR
    // disparaîtrait des options, le MultiSelect le perdrait au submit, et le payload
    // deviendrait un RETRAIT de rôle — que UserStateProcessor refuse en 403.
    const directeur = connecte(['ROLE_DIRECTEUR'], 51)
    const saFiche = fiche(['ROLE_DIRECTEUR'], 51)

    expect(directeur.assignableRoles(saFiche)).toContain('ROLE_DIRECTEUR')

    // Hors auto-édition, le plafond s'applique pleinement : pas de promotion au-dessus de 3.
    expect(directeur.assignableRoles(null)).not.toContain('ROLE_DIRECTEUR')
    expect(directeur.assignableRoles(null)).not.toContain('ROLE_ADMIN')
    expect(directeur.assignableRoles(null)).toEqual(
      expect.arrayContaining(['ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_FORMATEUR', 'ROLE_USER']),
    )

    // Même piège pour le secrétariat (fiche de niveau 3, plafond 1).
    const secretariat = connecte(['ROLE_SECRETARIAT'], 48)
    expect(secretariat.assignableRoles(fiche(['ROLE_SECRETARIAT'], 48))).toContain('ROLE_SECRETARIAT')
    expect(secretariat.assignableRoles(null)).toEqual(['ROLE_USER'])
  })

  // ── 7. Fail closed — le pendant exact du test ROLE_MARS du backend ──────────────
  it('traite un rôle inconnu comme le niveau le plus haut, et n\'en tire aucun plafond', () => {
    // Côté CIBLE : une fiche au rôle inconnu vaut le niveau 5. Seul le superviseur la gère.
    const inconnue = fiche(['ROLE_MARS'], 99)

    for (const role of ['ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_DIRECTEUR']) {
      expect(connecte([role], 7).canEdit(inconnue), role).toBe(false)
      expect(connecte([role], 7).canDelete(inconnue), role).toBe(false)
    }
    expect(connecte(['ROLE_ADMIN'], 7).canEdit(inconnue)).toBe(true)

    // Côté ACTEUR : un rôle inconnu n'accorde aucun plafond, et n'ouvre pas la page.
    const exotique = connecte(['ROLE_MARS'], 7)
    expect(exotique.ceiling.value).toBe(0)
    expect(exotique.canCreate.value).toBe(false)
    expect(exotique.canOpenPage.value).toBe(false)
    expect(exotique.canEdit(fiche(['ROLE_USER'], 1))).toBe(false)
  })
})
