import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface UserProfile {
  id: number
  email: string
  firstName: string
  lastName: string
  roles: string[]
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

  const userEmail = computed<string>(() => user.value?.email ?? '')

  const userName = computed<string>(() => {
    if (user.value) return `${user.value.firstName} ${user.value.lastName}`.trim()
    return userEmail.value
  })

  function hasRole(role: string): boolean {
    return roles.value.includes(role)
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

  return { user, isAuthenticated, roles, userEmail, userName, hasRole, login, refresh, logout, fetchMe }
})
