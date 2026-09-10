import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

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

  async function fetchMe(): Promise<void> {
    const ctrl = new AbortController()
    // Timeout augmenté à 10 s pour absorber le warm-up Docker
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    log('fetchMe → GET /api/auth/me …')
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: ctrl.signal,
      })
      log('fetchMe ← status', { status: response.status, ok: response.ok })
      if (response.ok) {
        user.value = (await response.json()) as UserProfile
        log('fetchMe → user set', { email: user.value.email, roles: user.value.roles })
      } else {
        user.value = null
        log('fetchMe → user null (réponse non-ok)')
      }
    } catch (err) {
      user.value = null
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      log('fetchMe → ERREUR', isTimeout ? 'TIMEOUT (AbortController)' : String(err))
    } finally {
      clearTimeout(timer)
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

  async function refresh(): Promise<boolean> {
    const ctrl = new AbortController()
    // Timeout augmenté à 10 s pour absorber le warm-up Docker
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    log('refresh → POST /api/auth/refresh …')
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: ctrl.signal,
      })
      log('refresh ← status', { status: response.status, ok: response.ok })
      if (!response.ok) return false
      await fetchMe()
      return true
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError'
      log('refresh → ERREUR', isTimeout ? 'TIMEOUT (AbortController)' : String(err))
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  async function logout(): Promise<void> {
    log('logout → POST /api/auth/logout …')
    try {
      const response = await fetch('/api/auth/logout', {
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
    userEmail, userName, hasRole, login, refresh, logout, fetchMe,
  }
})
