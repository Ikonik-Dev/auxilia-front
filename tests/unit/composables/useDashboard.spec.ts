import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Stub vue-router before importing the composable
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

import { useDashboard } from '@/composables/useDashboard'

function makeResponse(status: number, headers: Record<string, string> = {}): Response {
  return {
    status,
    headers: { get: (k: string) => headers[k] ?? null },
  } as unknown as Response
}

describe('useDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('sets data on successful fetch', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: { globalKpis: { totalFormations: 5 } },
      error: undefined,
      response: makeResponse(200),
    })

    const { data, loading, error, load } = useDashboard(fetchFn)

    expect(loading.value).toBe(false)
    const promise = load()
    expect(loading.value).toBe(true)
    await promise
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()
    expect((data.value as { globalKpis: { totalFormations: number } } | null)?.globalKpis.totalFormations).toBe(5)
  })

  it('sets error message on 5xx', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: { status: 500 },
      response: makeResponse(500),
    })

    const { error, load } = useDashboard(fetchFn)
    await load()

    expect(error.value).toBe('Impossible de charger le tableau de bord.')
  })

  it('sets isRateLimited and reads Retry-After header on 429', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: { status: 429 },
      response: makeResponse(429, { 'Retry-After': '30' }),
    })

    const { isRateLimited, rateLimitSeconds, load } = useDashboard(fetchFn)
    await load()

    expect(isRateLimited.value).toBe(true)
    expect(rateLimitSeconds.value).toBe(30)
  })

  it('clears rate limit after timeout', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: { status: 429 },
      response: makeResponse(429, { 'Retry-After': '10' }),
    })

    const { isRateLimited, load } = useDashboard(fetchFn)
    await load()
    expect(isRateLimited.value).toBe(true)

    vi.advanceTimersByTime(10_000)
    expect(isRateLimited.value).toBe(false)
  })

  it('blocks refetch while rate-limited', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      data: undefined,
      error: { status: 429 },
      response: makeResponse(429),
    })

    const { refetch, load } = useDashboard(fetchFn)
    await load()
    fetchFn.mockClear()

    refetch()
    expect(fetchFn).not.toHaveBeenCalled()
  })
})
