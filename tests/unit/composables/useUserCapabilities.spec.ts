import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { UserUserRead } from '@/api'

/**
 * Phase 17 étapes 4 puis 5 — les capacités de l'écran `/utilisateurs`.
 *
 * ⚠ CE FICHIER A CHANGÉ DE NATURE LE 10 SEPTEMBRE 2026. Il asservissait une TRANSCRIPTION
 * des tables de `UserVoter` — donc une copie, dans un autre dépôt, que rien ne confrontait
 * à l'original. Ces tables ont disparu du front : le backend calcule le plafond et transmet
 * ses conséquences (`assignableRoles`, `managesAllRoles`) dans `/api/auth/me`.
 *
 * ⚠ `lesSixPlafonds` A ÉTÉ SUPPRIMÉ, PAS ADAPTÉ. Son sujet n'existe plus côté front. La
 * propriété qu'il protégeait a déménagé dans `auxilia-api/tests/Functional/Auth/
 * AuthMeRolesTest.php`, où elle peut réellement asservir la source — c'est là que
 * `assignableRoles` d'un secrétariat est vérifié valoir `["ROLE_USER"]` et non davantage.
 *
 * Ce qui reste testé ici est ce qui reste décidé ici : l'application des deux régimes,
 * l'exception d'auto-édition, et l'union du formulaire.
 */

const mockUser = ref<{ id: number; roles: string[] } | null>(null)
const mockGranted = ref<string[]>([])
const mockAssignables = ref<string[]>([])
const mockManagesAll = ref(false)

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    user: mockUser.value,
    assignableRoles: mockAssignables.value,
    managesAllRoles: mockManagesAll.value,
    hasRole: (r: string) => mockGranted.value.includes(r),
  }),
}))

const { useUserCapabilities } = await import('@/composables/useUserCapabilities')

/**
 * Le contrat que `/api/auth/me` rend réellement, par rôle.
 *
 * ⚠ Ces valeurs sont un MIROIR de `AuthMeRolesTest` (backend), qui en est l'autorité. Si
 * les deux divergent un jour, c'est le backend qui a raison — ce fichier ne peut pas le
 * savoir, il ne parle à aucune API.
 */
const CONTRAT: Record<string, { granted: string[]; assignables: string[]; managesAll: boolean }> = {
  ROLE_ADMIN: {
    granted: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR', 'ROLE_RESPONSABLE_PED', 'ROLE_SECRETARIAT', 'ROLE_USER'],
    assignables: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_FORMATEUR', 'ROLE_USER'],
    managesAll: true,
  },
  ROLE_DIRECTEUR: {
    granted: ['ROLE_DIRECTEUR', 'ROLE_FORMATEUR', 'ROLE_RESPONSABLE_PED', 'ROLE_SECRETARIAT', 'ROLE_USER'],
    assignables: ['ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_FORMATEUR', 'ROLE_USER'],
    managesAll: false,
  },
  ROLE_SECRETARIAT: {
    granted: ['ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_USER'],
    assignables: ['ROLE_USER'],
    managesAll: false,
  },
  ROLE_RESPONSABLE_PED: {
    granted: ['ROLE_RESPONSABLE_PED', 'ROLE_USER'],
    assignables: ['ROLE_FORMATEUR', 'ROLE_USER'],
    managesAll: false,
  },
  ROLE_FORMATEUR: {
    granted: ['ROLE_FORMATEUR', 'ROLE_USER'],
    assignables: [],
    managesAll: false,
  },
  ROLE_USER: {
    granted: ['ROLE_USER'],
    assignables: [],
    managesAll: false,
  },
}

/** Connecte un compte tel que l'API le décrirait, puis rend ses capacités. */
function connecte(role: string, id = 1) {
  const c = CONTRAT[role]
  if (!c) throw new Error(`Rôle inconnu du contrat de test : ${role}`)

  mockUser.value = { id, roles: [role, 'ROLE_USER'] }
  mockGranted.value = c.granted
  mockAssignables.value = c.assignables
  mockManagesAll.value = c.managesAll

  return useUserCapabilities()
}

/** Une fiche cible minimale — seuls `id` et `roles` comptent pour les capacités. */
function fiche(roles: string[], id: number): UserUserRead {
  return { id, roles: [...roles, 'ROLE_USER'] } as unknown as UserUserRead
}

describe('useUserCapabilities — capacités pilotées par le serveur', () => {
  beforeEach(() => {
    mockUser.value = null
    mockGranted.value = []
    mockAssignables.value = []
    mockManagesAll.value = false
  })

  // ── 1. La porte de la page ──────────────────────────────────────────────────────
  it('ouvre la page aux cinq rôles concernés, et la ferme au stagiaire', () => {
    for (const role of [
      'ROLE_ADMIN',
      'ROLE_DIRECTEUR',
      'ROLE_SECRETARIAT',
      'ROLE_RESPONSABLE_PED',
      'ROLE_FORMATEUR',
    ]) {
      expect(connecte(role).canOpenPage.value, role).toBe(true)
    }

    // L'API rend 403 à un stagiaire sur GET /api/users : la porte doit dire la même chose.
    expect(connecte('ROLE_USER').canOpenPage.value).toBe(false)
  })

  // ── 2. La création ──────────────────────────────────────────────────────────────
  it('n\'autorise la création qu\'aux comptes ayant au moins un rôle assignable', () => {
    for (const role of ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED', 'ROLE_SECRETARIAT']) {
      expect(connecte(role).canCreate.value, role).toBe(true)
    }
    for (const role of ['ROLE_FORMATEUR', 'ROLE_USER']) {
      expect(connecte(role).canCreate.value, role).toBe(false)
    }
  })

  // ── 3. Édition / suppression, et l'interdit d'auto-suppression ──────────────────
  it('borne l\'édition au périmètre, et refuse à chacun de se supprimer', () => {
    const secretariat = connecte('ROLE_SECRETARIAT', 48)

    expect(secretariat.canEdit(fiche(['ROLE_USER'], 1))).toBe(true)
    expect(secretariat.canDelete(fiche(['ROLE_USER'], 1))).toBe(true)
    // Le cœur du choix A : le secrétariat s'arrête aux stagiaires, MÊME s'il hérite de
    // ROLE_RESPONSABLE_PED côté écrans. `assignableRoles` ne contient que ROLE_USER.
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
      const moi = connecte(role, id)
      expect(moi.canEdit(fiche([role], id)), `${role} édite sa fiche`).toBe(true)
      expect(moi.canDelete(fiche([role], id)), `${role} ne se supprime pas`).toBe(false)
    }
  })

  // ── 4. Choix C — le formateur consulte, il ne modifie pas ───────────────────────
  it('interdit au formateur de modifier ses stagiaires, mais pas sa propre fiche', () => {
    const formateur = connecte('ROLE_FORMATEUR', 42)
    const stagiaire = fiche(['ROLE_USER'], 1)

    // Il le VOIT (le tamis serveur le lui rend), il ne le MODIFIE pas.
    // Mesuré côté API : GET 200 / PATCH 403.
    expect(formateur.canEdit(stagiaire)).toBe(false)
    expect(formateur.canDelete(stagiaire)).toBe(false)
    expect(formateur.canCreate.value).toBe(false)

    expect(formateur.canEdit(fiche(['ROLE_FORMATEUR'], 42))).toBe(true)
  })

  // ── 5. Le piège de l'union ──────────────────────────────────────────────────────
  it('conserve dans les options les rôles que la fiche porte déjà', () => {
    // Un directeur éditant SA fiche. Sans l'union, ROLE_DIRECTEUR disparaîtrait des
    // options, le MultiSelect le perdrait au submit, et le payload deviendrait un RETRAIT
    // de rôle — que UserStateProcessor refuse en 403 au même titre qu'un ajout.
    const directeur = connecte('ROLE_DIRECTEUR', 51)

    expect(directeur.assignableRoles(fiche(['ROLE_DIRECTEUR'], 51))).toContain('ROLE_DIRECTEUR')

    // Hors auto-édition, le périmètre serveur s'applique pleinement.
    expect(directeur.assignableRoles(null)).not.toContain('ROLE_DIRECTEUR')
    expect(directeur.assignableRoles(null)).not.toContain('ROLE_ADMIN')

    // Même piège pour le secrétariat, dont la fiche est hors de son propre périmètre.
    const secretariat = connecte('ROLE_SECRETARIAT', 48)
    expect(secretariat.assignableRoles(fiche(['ROLE_SECRETARIAT'], 48))).toContain('ROLE_SECRETARIAT')
    expect(secretariat.assignableRoles(null)).toEqual(['ROLE_USER'])
  })

  // ── 6. LES DEUX RÉGIMES — le test qui empêche la régression du superviseur ──────
  /**
   * ⚠ TEST À DEUX BRANCHES, ET C'EST LE POINT. Une fiche au rôle INCONNU n'est dans aucun
   * `assignableRoles` — pas même celui du superviseur, qui ne liste que les rôles connus.
   * Un front qui ne transcrirait que la liste blanche la refuserait donc À TOUT LE MONDE,
   * superviseur compris : il la verrait dans sa collection (le tamis serveur ne filtre
   * rien à son plafond) **sans aucun bouton dessus**. La seule personne habilitée à la
   * gérer serait la seule à ne pas pouvoir agir.
   *
   * C'est `managesAllRoles` qui porte ce second régime. Supprimer l'une des deux branches
   * ci-dessous rendrait le défaut invisible.
   */
  it('exclut une fiche au rôle inconnu de tous les périmètres SAUF celui du superviseur', () => {
    const inconnue = fiche(['ROLE_MARS'], 99)

    // Branche 1 — fail closed pour tous les plafonds intermédiaires.
    for (const role of ['ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_DIRECTEUR']) {
      expect(connecte(role, 7).canEdit(inconnue), `${role} ne doit pas gérer un rôle inconnu`).toBe(false)
      expect(connecte(role, 7).canDelete(inconnue), role).toBe(false)
    }

    // Branche 2 — le superviseur, lui, DOIT pouvoir agir : second régime.
    const superviseur = connecte('ROLE_ADMIN', 7)
    expect(superviseur.canEdit(inconnue), 'le superviseur gère une fiche au rôle inconnu').toBe(true)
    expect(superviseur.canDelete(inconnue), 'et peut la supprimer').toBe(true)

    // Côté ACTEUR : un rôle inconnu n'ouvre pas la page et n'accorde aucune capacité.
    mockUser.value = { id: 7, roles: ['ROLE_MARS'] }
    mockGranted.value = ['ROLE_MARS', 'ROLE_USER']
    mockAssignables.value = []
    mockManagesAll.value = false

    const exotique = useUserCapabilities()
    expect(exotique.canOpenPage.value).toBe(false)
    expect(exotique.canCreate.value).toBe(false)
    expect(exotique.canEdit(fiche(['ROLE_USER'], 1))).toBe(false)
  })
})
