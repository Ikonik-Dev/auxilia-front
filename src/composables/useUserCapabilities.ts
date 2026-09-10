import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import type { UserUserRead } from '@/api'

/**
 * Capacités de gestion des comptes — Phase 17, étapes 4 puis 5.
 *
 * ✅ **CE FICHIER NE TRANSCRIT PLUS LE TIER MODEL depuis le 10 septembre 2026.**
 * Il portait `TARGET_TIER`, `ACTOR_CEILING`, `tierOfRoles()` et `ceilingOfRoles()` —
 * une copie des tables de `auxilia-api/src/Security/Voter/UserVoter.php` dans un autre
 * dépôt, que rien ne pouvait confronter à l'original. Les quatre ont été supprimés :
 * le backend calcule désormais le plafond et transmet ses conséquences dans
 * `/api/auth/me` (`assignableRoles`, `managesAllRoles`).
 *
 * Ce qui subsiste comme duplication, et qu'il ne faut pas se cacher : `PAGE_ROLES`
 * ci-dessous est un miroir de l'expression `security:` de `GetCollection` sur `User.php`.
 * C'est une duplication d'expression de rôles — du même ordre que les `meta.roles` des
 * autres routes — pas une duplication de modèle de niveaux. La dette 🟡 de `ROADMAP.md`
 * a été RÉDUITE à ce résidu, pas fermée.
 *
 * ── DEUX RÉGIMES, ET LE SECOND N'EST PAS UNE COMMODITÉ ──────────────────────────────
 * `ceiling >= tier(cible)` n'équivaut PAS à « tous les rôles de la cible sont
 * assignables ». L'équivalence tombe au plafond le plus haut, sur un rôle INCONNU :
 * `assignableRoles` ne liste que les rôles connus, donc un `ROLE_MARS` n'y est jamais ;
 * mais côté backend `tierOf()` le hisse au niveau 5, `5 >= 5` accorde, et
 * `ManageableUsersExtension` ne filtre rien à ce plafond — la fiche EST dans la
 * collection du superviseur. Sans `managesAllRoles`, il la verrait **sans aucun bouton
 * dessus** : la seule personne habilitée à la gérer serait la seule à ne pas pouvoir agir.
 * Asservi par `useUserCapabilities.spec.ts::roleInconnu…`, en DEUX branches.
 */

/**
 * Les rôles qui ont affaire à l'écran `/utilisateurs`.
 *
 * ⚠ Miroir de l'expression `security:` de `GetCollection` (`User.php`). Ce n'est PAS une
 * question de plafond : `ROLE_FORMATEUR` y figure alors qu'il n'en a aucun — il voit ses
 * stagiaires, le tamis serveur décide lesquels.
 * Lu via `hasRole()`, donc sur les rôles EFFECTIFS : un directeur entre par héritage.
 */
const PAGE_ROLES = [
  'ROLE_ADMIN',
  'ROLE_DIRECTEUR',
  'ROLE_SECRETARIAT',
  'ROLE_RESPONSABLE_PED',
  'ROLE_FORMATEUR',
]

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

export function useUserCapabilities() {
  const auth = useAuthStore()

  const canOpenPage = computed(() => PAGE_ROLES.some((r) => auth.hasRole(r)))

  /** Miroir de `USER_CREATE` sans sujet : « peut créer au moins le niveau le plus bas ». */
  const canCreate = computed(() => auth.managesAllRoles || auth.assignableRoles.length > 0)

  const isSelf = (u: UserUserRead): boolean =>
    u.id != null && u.id === auth.user?.id

  /**
   * « Ce compte est-il dans mon périmètre de gestion ? » — les deux régimes du tamis.
   * Le test de sous-ensemble est exactement celui du `JSON_CONTAINS` de
   * `ManageableUsersExtension` ; `managesAllRoles` transcrit son `return` anticipé.
   */
  const gerable = (u: UserUserRead): boolean =>
    auth.managesAllRoles
    || (u.roles ?? []).every((r) => r !== null && auth.assignableRoles.includes(r))

  /** Miroir de `UserVoter::EDIT` — `isSelf || plafond suffisant`. */
  const canEdit = (u: UserUserRead): boolean => isSelf(u) || gerable(u)

  /** Miroir de `UserVoter::DELETE` — personne ne supprime son propre compte. */
  const canDelete = (u: UserUserRead): boolean => !isSelf(u) && gerable(u)

  /**
   * Rôles proposables dans le formulaire : ceux du serveur, UNION les rôles déjà portés.
   *
   * ⚠ L'UNION EST OBLIGATOIRE, ET C'EST CONTRE-INTUITIF. Sans elle, l'auto-édition casse
   * pour tout compte dont la fiche est de niveau supérieur à son plafond — CINQ des six
   * comptes de démo (directeur, resp. péda, secrétariat, formateur et stagiaire ; seul le
   * superviseur y échappe). En pratique le formulaire n'en concerne que quatre : le
   * stagiaire n'atteint pas cet écran, sa route étant fermée.
   *
   * Le `MultiSelect` recevrait une valeur absente de ses options, la perdrait au submit, et
   * le payload deviendrait un CHANGEMENT de rôles que `UserStateProcessor` refuse en 403 —
   * y compris pour un RETRAIT, qu'il contrôle symétriquement (`array_diff` dans les deux
   * sens). C'est le pendant de la règle backend « les rôles inchangés passent toujours ».
   */
  const assignableRoles = (edited?: UserUserRead | null): string[] => {
    const current = (edited?.roles ?? []).filter((r): r is string => r !== null)

    return [...new Set([...auth.assignableRoles, ...current])]
  }

  return { canOpenPage, canCreate, canEdit, canDelete, assignableRoles }
}
