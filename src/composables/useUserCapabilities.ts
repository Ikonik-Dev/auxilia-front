import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserUserRead } from '@/api'

/**
 * ⚠ TROISIÈME COPIE DU TIER MODEL — ET LA SEULE QU'AUCUN TEST NE PEUT CONFRONTER.
 *
 * L'ORIGINAL EST LE BACKEND : `auxilia-api/src/Security/Voter/UserVoter.php`
 * (constantes `ACTOR_CEILING` et `TARGET_TIER`). Les deux tables ci-dessous en sont une
 * transcription. **Toute modification part de là, jamais d'ici.**
 *
 * Les deux autres copies vivent dans le même dépôt que l'original et sont confrontées à lui
 * par la suite PHPUnit (`UserVoterTest`, `ManageableUsersTest`). Celle-ci franchit une
 * frontière de dépôt : rien ne la vérifie automatiquement. C'est le même motif que
 * `CurrentUserQueryExtension.php:118-119` porte vis-à-vis de `DocumentVoter`, avec un cran
 * de risque en plus.
 *
 * MODE DE PANNE — FAIL-SAFE, et il faut le savoir pour ne pas surestimer la dette :
 * si cette table dérive de l'originale, le front proposera un rôle ou un bouton que l'API
 * refusera en **403**. C'est laid, c'est un défaut d'ergonomie — **ce n'est pas une faille** :
 * l'autorisation est rendue par `UserVoter` et `UserStateProcessor`, jamais ici. Un écran
 * qui ment n'ouvre aucun droit.
 *
 * La suppression de cette copie est consignée en dette 🟡 dans `ROADMAP.md` : exposer
 * `assignableRoles` dans `/api/auth/me`.
 */
const TARGET_TIER: Record<string, number> = {
  ROLE_ADMIN:           5,
  ROLE_DIRECTEUR:       4,
  ROLE_SECRETARIAT:     3,
  ROLE_RESPONSABLE_PED: 3,
  ROLE_FORMATEUR:       2,
  ROLE_USER:            1,
}

const ACTOR_CEILING: Record<string, number> = {
  ROLE_ADMIN:           5,
  ROLE_DIRECTEUR:       3,
  ROLE_RESPONSABLE_PED: 2,
  ROLE_SECRETARIAT:     1,
  ROLE_FORMATEUR:       0, // aucun plafond général — périmètre traité à part, en lecture seule
  ROLE_USER:            0,
}

/**
 * Libellés produit des rôles.
 *
 * Vit ici, et non dans `pages/utilisateurs/index.vue` où il était déclaré, parce qu'il a
 * DEUX consommateurs depuis le 9 septembre 2026 : les badges de la liste et les options du
 * formulaire. Le relabel `ROLE_ADMIN` → « Superviseur » est une décision produit qui ne doit
 * pas pouvoir diverger entre les deux écrans — c'est le seul argument du déplacement, et il
 * ne vaut que pour cette table.
 *
 * ⚠ `ROLE_ADMIN` reste la valeur TECHNIQUE partout : seul l'affichage change. Le renommage
 * du rôle lui-même (85 occurrences / 31 fichiers) est écarté — cf. ROADMAP, Phase 17.
 */
export const ROLE_LABELS: Record<string, string> = {
  ROLE_ADMIN:           'Superviseur',
  ROLE_DIRECTEUR:       'Directeur',
  ROLE_SECRETARIAT:     'Secrétariat',
  ROLE_RESPONSABLE_PED: 'Resp. péda.',
  ROLE_FORMATEUR:       'Formateur',
  ROLE_USER:            'Stagiaire',
}

/** Les 5 rôles qui ont affaire à l'écran — miroir de `GetCollection` sur `User.php`. */
const PAGE_ROLES = [
  'ROLE_ADMIN',
  'ROLE_DIRECTEUR',
  'ROLE_SECRETARIAT',
  'ROLE_RESPONSABLE_PED',
  'ROLE_FORMATEUR',
]

/** Niveau d'une fiche. Rôle inconnu ⇒ 5. Fail closed, comme `UserVoter::tierOf()`. */
export function tierOfRoles(roles: Array<string | null> | undefined): number {
  let tier = 1 // `getRoles()` garantit toujours ROLE_USER
  for (const role of roles ?? []) {
    if (role) tier = Math.max(tier, TARGET_TIER[role] ?? 5)
  }
  return tier
}

/** Plafond d'un acteur. Rôle inconnu ⇒ 0. Fail closed, comme `UserVoter::ceilingOfRoles()`. */
export function ceilingOfRoles(roles: string[]): number {
  return roles.reduce((max, role) => Math.max(max, ACTOR_CEILING[role] ?? 0), 0)
}

export function useUserCapabilities() {
  const auth = useAuthStore()

  const ceiling = computed(() => ceilingOfRoles(auth.roles))

  const canOpenPage = computed(() => PAGE_ROLES.some((r) => auth.hasRole(r)))

  /** Miroir de `USER_CREATE` sans sujet : « peut créer au moins le niveau le plus bas ». */
  const canCreate = computed(() => ceiling.value >= 1)

  const isSelf = (u: UserUserRead): boolean =>
    u.id != null && u.id === auth.user?.id

  /** Miroir de `UserVoter::EDIT` — `isSelf || ceiling >= tier`. */
  const canEdit = (u: UserUserRead): boolean =>
    isSelf(u) || ceiling.value >= tierOfRoles(u.roles)

  /** Miroir de `UserVoter::DELETE` — `!isSelf && ceiling >= tier`. Personne ne se supprime. */
  const canDelete = (u: UserUserRead): boolean =>
    !isSelf(u) && ceiling.value >= tierOfRoles(u.roles)

  /**
   * Rôles proposables dans le formulaire : le plafond, UNION les rôles déjà portés.
   *
   * ⚠ L'UNION EST OBLIGATOIRE, ET C'EST CONTRE-INTUITIF. Filtrer au seul plafond casserait
   * l'AUTO-ÉDITION pour tout compte dont la fiche est de niveau supérieur à son plafond.
   * C'est le cas de CINQ des six comptes de démo — directeur (4 > 3), resp. péda (3 > 2),
   * secrétariat (3 > 1), formateur (2 > 0) et stagiaire (1 > 0) ; seul le superviseur y
   * échappe (5 = 5). En pratique le formulaire n'en concerne que quatre : le stagiaire
   * n'atteint pas cet écran, sa route étant fermée.
   *
   * Sans l'union, le `MultiSelect` recevrait une valeur absente de ses options, la perdrait
   * au submit, et le payload deviendrait un CHANGEMENT de rôles que `UserStateProcessor`
   * refuse en 403 — y compris pour un RETRAIT, qu'il contrôle symétriquement (`array_diff`
   * dans les deux sens).
   *
   * C'est le pendant exact de la règle backend « les rôles inchangés passent toujours »
   * (ROADMAP : « retenue des rôles existants en auto-édition autorisée »).
   */
  const assignableRoles = (edited?: UserUserRead | null): string[] => {
    // `tierOfRoles([r])` plutot que `TARGET_TIER[r]` : `noUncheckedIndexedAccess` rend
    // l'acces indexe `number | undefined`, et surtout le `?? 5` du fail closed n'a alors
    // qu'un seul endroit ou vivre.
    const allowed = Object.keys(TARGET_TIER).filter((r) => tierOfRoles([r]) <= ceiling.value)
    const current = (edited?.roles ?? []).filter((r): r is string => r !== null)

    // Dédoublonné, puis ordonné du niveau le plus élevé au plus bas.
    return [...new Set([...allowed, ...current])].sort(
      (a, b) => (TARGET_TIER[b] ?? 5) - (TARGET_TIER[a] ?? 5),
    )
  }

  return { ceiling, canOpenPage, canCreate, canEdit, canDelete, assignableRoles }
}
