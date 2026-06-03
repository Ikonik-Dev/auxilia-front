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
    const timer = setTimeout(() => ctrl.abort(), 3000)
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
        signal: ctrl.signal,
      })
      if (response.ok) {
        user.value = (await response.json()) as UserProfile
      } else {
        user.value = null
      }
    } catch {
      user.value = null
    } finally {
      clearTimeout(timer)
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      throw new Error('Identifiants invalides')
    }
    await fetchMe()
  }

  async function refresh(): Promise<boolean> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        signal: ctrl.signal,
      })
      if (!response.ok) return false
      await fetchMe()
      return true
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  function logout(): void {
    user.value = null
  }

  return { user, isAuthenticated, roles, userEmail, userName, hasRole, login, refresh, logout, fetchMe }
})
