import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const TOKEN_KEY = 'auxilia_jwt'
const REFRESH_KEY = 'auxilia_refresh'

interface JwtPayload {
  username?: string
  email?: string
  roles: string[]
  exp: number
  iat: number
}

function decodePayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64)) as JwtPayload
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY))

  const payload = computed<JwtPayload | null>(() =>
    token.value ? decodePayload(token.value) : null,
  )

  const isAuthenticated = computed<boolean>(() => {
    if (!token.value || !payload.value) return false
    return payload.value.exp * 1000 > Date.now()
  })

  const roles = computed<string[]>(() => payload.value?.roles ?? [])

  const userEmail = computed<string>(
    () => payload.value?.username ?? payload.value?.email ?? '',
  )

  function hasRole(role: string): boolean {
    return roles.value.includes(role)
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await fetch('/api/login_check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    })
    if (!response.ok) {
      throw new Error('Identifiants invalides')
    }
    const data = (await response.json()) as { token: string; refresh_token?: string }
    token.value = data.token
    localStorage.setItem(TOKEN_KEY, data.token)
    if (data.refresh_token) {
      refreshToken.value = data.refresh_token
      localStorage.setItem(REFRESH_KEY, data.refresh_token)
    }
  }

  async function refresh(): Promise<boolean> {
    if (!refreshToken.value) return false
    try {
      const response = await fetch('/api/token/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken.value }),
      })
      if (!response.ok) return false
      const data = (await response.json()) as { token: string; refresh_token?: string }
      token.value = data.token
      localStorage.setItem(TOKEN_KEY, data.token)
      if (data.refresh_token) {
        refreshToken.value = data.refresh_token
        localStorage.setItem(REFRESH_KEY, data.refresh_token)
      }
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    token.value = null
    refreshToken.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
  }

  return { token, isAuthenticated, roles, userEmail, hasRole, login, refresh, logout }
})
