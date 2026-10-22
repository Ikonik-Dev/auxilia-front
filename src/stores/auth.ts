import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { refreshCoordinator, type RefreshOutcome } from '@/api/authInterceptor'

/**
 * ⚠ DEUX NOTIONS DE RÔLE, ET ELLES NE SE CONTIENNENT PAS (Phase 17 étape 5, 10 sept. 2026).
 *
 * `roles`           — ASSIGNÉS, bruts. Gouvernaient le plafond de gestion ; depuis que le
 *                     backend le calcule, plus rien ne les lit côté front. NE JAMAIS y
 *                     mettre le déplié : un `ROLE_SECRETARIAT` y gagnerait
 *                     `ROLE_RESPONSABLE_PED`, donc 47 fiches gérables au lieu de 41.
 * `grantedRoles`    — EFFECTIFS, dépliés par `role_hierarchy` côté serveur. Gouvernent
 *                     l'ACCÈS AUX ÉCRANS — c'est ce que lit `hasRole()`.
 * `assignableRoles` — la liste blanche du tier model : ce que ce compte peut POSER sur une
 *                     fiche. Remplace les tables que le front recopiait.
 * `managesAllRoles` — le SECOND RÉGIME : au plafond le plus haut, aucun filtre ne
 *                     s'applique. Sans ce champ, une fiche au rôle INCONNU s'afficherait
 *                     sans bouton chez la seule personne habilitée à la gérer.
 *
 * Source : `auxilia-api/src/Controller/AuthController.php`, action `me()`.
 */
interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  roles: string[]
  grantedRoles?: string[]
  assignableRoles?: string[]
  managesAllRoles?: boolean
  avatar: string | null
  isActive: boolean
}

// Logging dev-only — préfixé [AUTH] pour filtrer facilement dans la console
function log(msg: string, data?: unknown): void {
  if (!import.meta.env.DEV) return
  const ts = new Date().toISOString().slice(11, 23) // HH:mm:ss.mmm
  if (data !== undefined) {
    console.log(`[AUTH ${ts}] ${msg}`, data)
  } else {
    console.log(`[AUTH ${ts}] ${msg}`)
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserProfile | null>(null)

  const isAuthenticated = computed<boolean>(() => user.value !== null)

  const roles = computed<string[]>(() => user.value?.roles ?? [])

  /**
   * Rôles effectifs — ce que lit `hasRole()`, donc tous les tests d'accès écran.
   *
   * ⚠ Le repli sur `roles` n'est PAS une commodité : les deux dépôts se déploient
   * indépendamment (`CLAUDE.md` §2.2). Face à une API antérieure au 10 septembre 2026, un
   * repli sur `[]` verrouillerait toute personne du personnel hors de tous les écrans —
   * une panne totale déguisée en « fail closed ». Le repli sur `roles` dégrade au
   * comportement d'avant l'étape 5, qui n'a jamais accordé un droit de trop.
   */
  const grantedRoles = computed<string[]>(() => user.value?.grantedRoles ?? user.value?.roles ?? [])

  /**
   * Les deux champs de CAPACITÉ, eux, échouent FERMÉ — `[]` et `false`.
   * Ici l'inverse du raisonnement ci-dessus s'applique : mieux vaut un bouton manquant
   * qu'un bouton qui promet une action refusée en 403.
   */
  const assignableRoles = computed<string[]>(() => user.value?.assignableRoles ?? [])
  const managesAllRoles = computed<boolean>(() => user.value?.managesAllRoles ?? false)

  const userEmail = computed<string>(() => user.value?.email ?? '')

  const userName = computed<string>(() => {
    if (user.value) return `${user.value.firstName} ${user.value.lastName}`.trim()
    return userEmail.value
  })

  /**
   * ⚠ Lit les rôles EFFECTIFS depuis le 10 septembre 2026, plus les rôles bruts.
   * Ses 13 sites d'appel sont tous des tests d'ACCÈS ÉCRAN — c'est la sémantique qu'ils
   * ont toujours voulue, et que l'absence de dépliage leur refusait : un directeur n'avait
   * pas `ROLE_RESPONSABLE_PED` ici alors qu'il l'a côté Symfony.
   * ⚠ Ne jamais s'en servir pour calculer un droit de GESTION : c'est `assignableRoles`.
   */
  function hasRole(role: string): boolean {
    return grantedRoles.value.includes(role)
  }

  /** Délai de chaque appel d'authentification : le conteneur Docker met jusqu'à 4-5 s à froid. */
  const AUTH_TIMEOUT_MS = 10_000

  /**
   * Interroge `GET /api/auth/me` et, si la réponse est 200, installe le profil.
   * - `ok`           : profil reçu et installé ;
   * - `unauthorized` : 401, la session n'existe pas ou plus ;
   * - `transient`    : toute autre issue (429, 5xx, réseau, timeout) : on ne sait RIEN de la
   *                    session, l'appelant ne doit pas la déclarer perdue.
   * N'efface jamais `user` : c'est à l'appelant de décider.
   */
  async function requestMe(): Promise<'ok' | 'unauthorized' | 'transient'> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AUTH_TIMEOUT_MS)
    log('me → GET /api/auth/me …')
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: ctrl.signal,
      })
      log('me ← status', { status: response.status, ok: response.ok })
      if (response.ok) {
        user.value = (await response.json()) as UserProfile
        log('me → user set', { email: user.value.email, roles: user.value.roles })
        return 'ok'
      }
      return response.status === 401 ? 'unauthorized' : 'transient'
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      log('me → ERREUR', isTimeout ? 'TIMEOUT (AbortController)' : String(err))
      return 'transient'
    } finally {
      clearTimeout(timer)
    }
  }

  async function fetchMe(): Promise<void> {
    // Démarrage et garde de routeur : toute issue autre que « profil reçu » = pas de session.
    if ((await requestMe()) !== 'ok') {
      user.value = null
      log('fetchMe → user null')
    }
  }

  async function login(email: string, password: string): Promise<void> {
    log('login → POST /api/auth/login …', { email })
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    log('login ← status', { status: response.status, ok: response.ok })
    if (!response.ok) {
      throw new Error('Identifiants invalides')
    }
    await fetchMe()
    // Appel debug : confirme ce que le backend a reçu comme cookies
    if (import.meta.env.DEV) {
      try {
        const dbg = await fetch('/api/auth/debug', { credentials: 'include' })
        if (dbg.ok) log('debug ← backend voit', await dbg.json())
      } catch { /* non bloquant */ }
    }
    if (!user.value) {
      throw new Error('Session invalide après connexion')
    }
  }

  /**
   * Un appel `POST /api/auth/refresh`, rendu en issue typée (cf. `RefreshOutcome`).
   *
   * - 2xx : la session est renouvelée ; le profil est relu. Un 401 sur cette relecture, juste
   *   après un refresh réussi, veut dire « compte désactivé entre-temps » : session perdue.
   * - 401 : le jeton de rafraîchissement n'est pas accepté. Avant de conclure, SONDE `/me` : les
   *   cookies sont communs à tous les onglets, un autre onglet a pu renouveler la session une
   *   fraction de seconde plus tôt (le jeton est à usage unique). `/me` répond 200 → renouvelée.
   * - tout le reste (429, 5xx, réseau, timeout) : transitoire, on ne déconnecte pas.
   */
  async function requestRefresh(): Promise<RefreshOutcome> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), AUTH_TIMEOUT_MS)
    let status: number
    log('refresh → POST /api/auth/refresh …')
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: ctrl.signal,
      })
      status = response.status
      log('refresh ← status', { status, ok: response.ok })
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      log('refresh → ERREUR', isTimeout ? 'TIMEOUT (AbortController)' : String(err))
      return 'transient'
    } finally {
      clearTimeout(timer)
    }

    if (status >= 200 && status < 300) {
      // Seul un 401 de la relecture contredit le refresh. Un échec transitoire (429, réseau,
      // timeout) laisse les cookies renouvelés : la session est valide, le rejeu peut partir.
      // Le profil, lui, n'est peut-être pas relu : `refresh()` le vérifie (`user.value !== null`).
      return (await requestMe()) === 'unauthorized' ? 'lost' : 'refreshed'
    }
    if (status === 401) {
      const probe = await requestMe()
      if (probe === 'ok') return 'refreshed'
      return probe === 'unauthorized' ? 'lost' : 'transient'
    }
    return 'transient'
  }

  /** Renouvelle la session (garde de routeur) ; vrai seulement si un profil est en place ensuite. */
  async function refresh(): Promise<boolean> {
    const outcome = await refreshCoordinator.run(requestRefresh)
    return outcome === 'refreshed' && user.value !== null
  }

  /**
   * La session est définitivement perdue (appelé par l'intercepteur). Idempotent : plusieurs
   * requêtes en 401 simultanées concluent « perdue » ensemble. Rend vrai au PREMIER appel
   * seulement, c'est-à-dire quand il faut rediriger vers /login.
   */
  function markSessionLost(): boolean {
    if (user.value === null) return false
    user.value = null
    log('session perdue → user effacé')
    return true
  }

  /**
   * ⚠ `/api/auth/refresh/logout`, PAS `/api/auth/logout` : seule la première révoque le jeton
   * de rafraîchissement en base. L'ancienne route ne supprimait que les cookies, et le jeton
   * restait rejouable jusqu'à son expiration.
   */
  async function logout(): Promise<void> {
    log('logout → POST /api/auth/refresh/logout …')
    try {
      const response = await fetch('/api/auth/refresh/logout', {
        method: 'POST',
        credentials: 'include',
      })
      log('logout ← status', { status: response.status, ok: response.ok })
    } finally {
      user.value = null
      log('logout → user effacé')
    }
  }

  return {
    user, isAuthenticated, roles, grantedRoles, assignableRoles, managesAllRoles,
    userEmail, userName, hasRole, login, refresh, requestRefresh, markSessionLost, logout, fetchMe,
  }
})
