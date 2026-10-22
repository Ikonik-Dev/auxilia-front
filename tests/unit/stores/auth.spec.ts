import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { createClient, createConfig } from '@/api/generated/client'
import { installAuthInterceptor } from '@/api/authInterceptor'

/**
 * Lot 1.1b (F1) — issues du refresh, sonde /me, logout.
 *
 * `fetch` est simulé route par route ; chaque test déclare la réponse de `/refresh` et de `/me`.
 */

const PROFIL = {
  id: 7,
  email: 'stagiaire@auxilium.test',
  firstName: 'Test',
  lastName: 'Stagiaire',
  roles: ['ROLE_USER'],
  avatar: null,
  isActive: true,
}

type Reponse = number | 'reseau' | 'timeout'

function simuler(routes: { refresh?: Reponse; me?: Reponse; logout?: Reponse }) {
  const appels: string[] = []
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    appels.push(`${init?.method ?? 'GET'} ${url}`)
    const cle = url.includes('/refresh/logout') ? 'logout' : url.includes('/refresh') ? 'refresh' : 'me'
    const rep = routes[cle]
    if (rep === undefined) throw new Error(`route non prévue : ${url}`)
    if (rep === 'reseau') return Promise.reject(new TypeError('Failed to fetch'))
    if (rep === 'timeout') {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      })
    }
    const corps = cle === 'me' && rep === 200 ? JSON.stringify(PROFIL) : null
    return Promise.resolve(new Response(corps, { status: rep }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return appels
}

beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('auth.requestRefresh', () => {
  it('refresh 204 puis profil relu : refreshed, profil en place', async () => {
    simuler({ refresh: 204, me: 200 })
    const auth = useAuthStore()
    expect(await auth.requestRefresh()).toBe('refreshed')
    expect(auth.user?.email).toBe(PROFIL.email)
  })

  it('refresh 204 puis /me 401 (compte désactivé entre-temps) : lost', async () => {
    simuler({ refresh: 204, me: 401 })
    expect(await useAuthStore().requestRefresh()).toBe('lost')
  })

  it('refresh 204 puis /me en échec transitoire : refreshed (le cookie est renouvelé)', async () => {
    simuler({ refresh: 204, me: 500 })
    expect(await useAuthStore().requestRefresh()).toBe('refreshed')
  })

  it('D-D (a) : refresh 401 mais /me 200 (autre onglet passé avant) : refreshed', async () => {
    const appels = simuler({ refresh: 401, me: 200 })
    const auth = useAuthStore()
    expect(await auth.requestRefresh()).toBe('refreshed')
    expect(appels).toEqual(['POST /api/auth/refresh', 'GET /api/auth/me'])
    expect(auth.user?.email).toBe(PROFIL.email)
  })

  it('D-D (a) : refresh 401 et /me 401 : lost', async () => {
    simuler({ refresh: 401, me: 401 })
    expect(await useAuthStore().requestRefresh()).toBe('lost')
  })

  it('D-D (a) : refresh 401 et la sonde échoue (5xx) : transient, pas lost', async () => {
    simuler({ refresh: 401, me: 503 })
    expect(await useAuthStore().requestRefresh()).toBe('transient')
  })

  it('D-F : 429 est transitoire, et la sonde n’est même pas lancée', async () => {
    const appels = simuler({ refresh: 429 })
    expect(await useAuthStore().requestRefresh()).toBe('transient')
    expect(appels).toEqual(['POST /api/auth/refresh'])
  })

  it('D-F : 500 est transitoire', async () => {
    simuler({ refresh: 500 })
    expect(await useAuthStore().requestRefresh()).toBe('transient')
  })

  it('D-F : une erreur réseau est transitoire', async () => {
    simuler({ refresh: 'reseau' })
    expect(await useAuthStore().requestRefresh()).toBe('transient')
  })

  it('D-F : un timeout (10 s) est transitoire', async () => {
    vi.useFakeTimers()
    simuler({ refresh: 'timeout' })
    const issue = useAuthStore().requestRefresh()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await issue).toBe('transient')
  })
})

describe('auth.refresh (garde de routeur)', () => {
  it('vrai quand la session est renouvelée et le profil en place', async () => {
    simuler({ refresh: 204, me: 200 })
    expect(await useAuthStore().refresh()).toBe(true)
  })

  it('faux sur échec transitoire, sans effacer ce qui est en place', async () => {
    simuler({ refresh: 429 })
    const auth = useAuthStore()
    auth.user = { ...PROFIL }
    expect(await auth.refresh()).toBe(false)
    expect(auth.user).not.toBeNull()
  })
})

describe('auth.refresh et intercepteur : un seul verrou', () => {
  it('un refresh du garde et un refresh de l’intercepteur concurrents ne font qu’UN appel /refresh', async () => {
    // Le refresh reste en vol tant que le test ne le libère pas : les deux demandes se chevauchent.
    let liberer!: () => void
    const enVol = new Promise<void>((resolve) => (liberer = resolve))
    const appels: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      appels.push(`${init?.method ?? 'GET'} ${url}`)
      if (url.includes('/refresh')) {
        await enVol
        return new Response(null, { status: 204 })
      }
      return new Response(JSON.stringify(PROFIL), { status: 200 })
    }))

    // Câblage de `main.ts`, verrou par défaut (celui de l'application), pas un verrou de test.
    const auth = useAuthStore()
    let n = 0
    const sdkFetch = async () => new Response('{}', { status: n++ === 0 ? 401 : 200 })
    const client = createClient(createConfig({ baseUrl: 'http://localhost', fetch: sdkFetch as typeof fetch }))
    installAuthInterceptor(client, { doRefresh: auth.requestRefresh, onSessionLost: vi.fn() })

    const garde = auth.refresh()
    const requete = client.get({ url: '/api/formations' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    liberer()

    expect(await garde).toBe(true)
    expect((await requete).response?.status).toBe(200)
    expect(appels.filter((a) => a === 'POST /api/auth/refresh')).toHaveLength(1)
  })
})

describe('auth.markSessionLost', () => {
  it('rend vrai au premier appel seulement et efface le profil', () => {
    const auth = useAuthStore()
    auth.user = { ...PROFIL }
    expect(auth.markSessionLost()).toBe(true)
    expect(auth.user).toBeNull()
    expect(auth.markSessionLost()).toBe(false)
  })
})

describe('auth.fetchMe', () => {
  it('efface le profil sur toute issue autre que 200', async () => {
    simuler({ me: 500 })
    const auth = useAuthStore()
    auth.user = { ...PROFIL }
    await auth.fetchMe()
    expect(auth.user).toBeNull()
  })
})

describe('auth.logout', () => {
  it('appelle /api/auth/refresh/logout (qui révoque le jeton), pas /api/auth/logout', async () => {
    const appels = simuler({ logout: 204 })
    const auth = useAuthStore()
    auth.user = { ...PROFIL }
    await auth.logout()
    expect(appels).toEqual(['POST /api/auth/refresh/logout'])
    expect(auth.user).toBeNull()
  })

  it('efface le profil même si la requête échoue', async () => {
    simuler({ logout: 'reseau' })
    const auth = useAuthStore()
    auth.user = { ...PROFIL }
    await expect(auth.logout()).rejects.toThrow()
    expect(auth.user).toBeNull()
  })
})
