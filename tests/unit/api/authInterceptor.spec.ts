import { describe, it, expect, vi } from 'vitest'
import { createClient, createConfig } from '@/api/generated/client'
import {
  createRefreshCoordinator,
  installAuthInterceptor,
  type RefreshOutcome,
} from '@/api/authInterceptor'

/**
 * Lot 1.1b (F1) — intercepteur 401 → refresh → rejeu.
 *
 * Les tests passent par le VRAI client généré (`createClient`) avec un `fetch` factice : l'ordre
 * des intercepteurs, le clonage des requêtes et le rejeu sont ceux de la production. Seuls le
 * réseau et l'appel de refresh sont simulés.
 */

type Handler = (request: Request) => Response | Promise<Response>

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(opts: {
  handler: Handler
  doRefresh?: () => Promise<RefreshOutcome>
}) {
  const calls: Array<{ method: string; path: string; body: string | null }> = []
  // `function` et non flèche : on vérifie que le rejeu n'appelle pas fetch comme une méthode.
  const fakeFetch = async function (this: unknown, request: Request): Promise<Response> {
    if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
    // Lecture DESTRUCTIVE du corps, comme un vrai fetch : une requête déjà envoyée n'est plus rejouable.
    const body = request.body === null ? null : await request.text()
    calls.push({ method: request.method, path: new URL(request.url).pathname, body })
    return opts.handler(request)
  }
  const client = createClient(createConfig({ baseUrl: 'http://localhost', fetch: fakeFetch as typeof fetch }))
  const doRefresh = vi.fn(opts.doRefresh ?? (async () => 'refreshed' as RefreshOutcome))
  const onSessionLost = vi.fn()
  const coordinator = createRefreshCoordinator()
  installAuthInterceptor(client, { doRefresh, onSessionLost, coordinator })
  return { client, calls, doRefresh, onSessionLost, coordinator }
}

const pathsOf = (calls: Array<{ path: string }>) => calls.map((c) => c.path)

describe('installAuthInterceptor', () => {
  it('laisse passer une réponse non-401 sans refresh', async () => {
    const t = setup({ handler: () => jsonResponse(200, { ok: 1 }) })
    const res = await t.client.get({ url: '/api/formations' })
    expect(res.response?.status).toBe(200)
    expect(t.doRefresh).not.toHaveBeenCalled()
    expect(t.calls).toHaveLength(1)
  })

  it('401 → un refresh → un rejeu, et l’appelant reçoit la réponse du rejeu', async () => {
    let n = 0
    const t = setup({ handler: () => (n++ === 0 ? jsonResponse(401) : jsonResponse(200, { rejoue: true })) })
    const res = await t.client.get({ url: '/api/formations' })
    expect(res.response?.status).toBe(200)
    expect(res.data).toEqual({ rejoue: true })
    expect(t.doRefresh).toHaveBeenCalledTimes(1)
    expect(pathsOf(t.calls)).toEqual(['/api/formations', '/api/formations'])
  })

  it('rejoue un POST avec son corps d’origine', async () => {
    let n = 0
    const t = setup({ handler: () => (n++ === 0 ? jsonResponse(401) : jsonResponse(201)) })
    const res = await t.client.post({
      url: '/api/messages',
      body: { texte: 'bonjour' },
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.response?.status).toBe(201)
    expect(t.calls).toHaveLength(2)
    expect(t.calls[0]?.body).toBe('{"texte":"bonjour"}')
    expect(t.calls[1]?.body).toBe('{"texte":"bonjour"}')
    expect(t.calls[1]?.method).toBe('POST')
  })

  it('six 401 simultanés partagent UN seul refresh, et chacun est rejoué', async () => {
    const seen = new Map<string, number>()
    const t = setup({
      handler: (req) => {
        const k = req.url
        const c = (seen.get(k) ?? 0) + 1
        seen.set(k, c)
        return c === 1 ? jsonResponse(401) : jsonResponse(200)
      },
      doRefresh: () => new Promise((resolve) => setTimeout(() => resolve('refreshed'), 20)),
    })
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => t.client.get({ url: `/api/ressource-${i}` })),
    )
    expect(results.map((r) => r.response?.status)).toEqual([200, 200, 200, 200, 200, 200])
    expect(t.doRefresh).toHaveBeenCalledTimes(1)
    expect(t.calls).toHaveLength(12)
  })

  it('une requête partie AVANT la fin d’un refresh est rejouée sans en relancer un second', async () => {
    let lateResolve: (() => void) | undefined
    const late = new Promise<void>((r) => {
      lateResolve = r
    })
    const attempts = new Map<string, number>()
    const t = setup({
      handler: async (req) => {
        const path = new URL(req.url).pathname
        const c = (attempts.get(path) ?? 0) + 1
        attempts.set(path, c)
        if (c > 1) return jsonResponse(200)
        if (path === '/api/lente') await late // sa réponse 401 n'arrive qu'après le refresh
        return jsonResponse(401)
      },
    })
    const lente = t.client.get({ url: '/api/lente' })
    const rapide = await t.client.get({ url: '/api/rapide' }) // 401 → refresh → rejeu
    expect(rapide.response?.status).toBe(200)
    expect(t.doRefresh).toHaveBeenCalledTimes(1)
    lateResolve?.()
    const resLente = await lente
    expect(resLente.response?.status).toBe(200)
    expect(t.doRefresh).toHaveBeenCalledTimes(1) // toujours un seul
  })

  it('ne rafraîchit ni ne rejoue jamais une route /api/auth/*', async () => {
    const t = setup({ handler: () => jsonResponse(401) })
    const res = await t.client.post({ url: '/api/auth/login', body: { email: 'a@b.test' } })
    expect(res.response?.status).toBe(401)
    expect(t.doRefresh).not.toHaveBeenCalled()
    expect(t.onSessionLost).not.toHaveBeenCalled()
    expect(t.calls).toHaveLength(1)
  })

  it('session perdue : déconnecte, rend le 401, ne rejoue pas', async () => {
    const t = setup({ handler: () => jsonResponse(401), doRefresh: async () => 'lost' })
    const res = await t.client.get({ url: '/api/formations' })
    expect(res.response?.status).toBe(401)
    expect(t.onSessionLost).toHaveBeenCalledTimes(1)
    expect(t.calls).toHaveLength(1)
  })

  it('échec transitoire (429, réseau, timeout) : ne déconnecte pas, rend le 401, ne rejoue pas', async () => {
    const t = setup({ handler: () => jsonResponse(401), doRefresh: async () => 'transient' })
    const res = await t.client.get({ url: '/api/formations' })
    expect(res.response?.status).toBe(401)
    expect(t.onSessionLost).not.toHaveBeenCalled()
    expect(t.calls).toHaveLength(1)
  })

  it('un rejeu qui retombe en 401 est rendu tel quel : un seul rejeu, pas de boucle', async () => {
    const t = setup({ handler: () => jsonResponse(401) })
    const res = await t.client.get({ url: '/api/formations' })
    expect(res.response?.status).toBe(401)
    expect(t.doRefresh).toHaveBeenCalledTimes(1)
    expect(t.calls).toHaveLength(2)
  })

  it('après un refresh terminé, un nouveau 401 déclenche un nouveau refresh', async () => {
    const attempts = new Map<string, number>()
    const t = setup({
      handler: (req) => {
        const c = (attempts.get(req.url) ?? 0) + 1
        attempts.set(req.url, c)
        return c === 1 ? jsonResponse(401) : jsonResponse(200)
      },
    })
    await t.client.get({ url: '/api/a' })
    await t.client.get({ url: '/api/b' })
    expect(t.doRefresh).toHaveBeenCalledTimes(2)
  })
})

describe('createRefreshCoordinator', () => {
  it('rejoint le refresh en cours au lieu d’en lancer un autre', async () => {
    const c = createRefreshCoordinator()
    const doRefresh = vi.fn(() => new Promise<RefreshOutcome>((r) => setTimeout(() => r('refreshed'), 10)))
    const [a, b] = await Promise.all([c.run(doRefresh), c.run(doRefresh)])
    expect([a, b]).toEqual(['refreshed', 'refreshed'])
    expect(doRefresh).toHaveBeenCalledTimes(1)
  })

  it('ne compte comme refresh réussi que l’issue « refreshed »', async () => {
    const c = createRefreshCoordinator()
    await c.run(async () => 'transient')
    await c.run(async () => 'lost')
    expect(c.epoch).toBe(0)
    await c.run(async () => 'refreshed')
    expect(c.epoch).toBe(1)
  })

  it('libère le verrou une fois le refresh terminé', async () => {
    const c = createRefreshCoordinator()
    const doRefresh = vi.fn(async () => 'refreshed' as RefreshOutcome)
    await c.run(doRefresh)
    await c.run(doRefresh)
    expect(doRefresh).toHaveBeenCalledTimes(2)
  })
})
