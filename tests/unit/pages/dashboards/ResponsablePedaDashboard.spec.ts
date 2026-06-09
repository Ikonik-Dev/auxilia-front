import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api', () => ({
  apiDashboardresponsablePedaGet: vi.fn(),
}))

const mockDashboard = {
  data: ref(null),
  loading: ref(false),
  error: ref<string | null>(null),
  isRateLimited: ref(false),
  rateLimitSeconds: ref(0),
  load: vi.fn(),
  refetch: vi.fn(),
}

vi.mock('@/composables/useDashboard', () => ({
  useDashboard: () => mockDashboard,
}))

const globalStubs = {
  Card: { template: '<div class="p-card"><slot name="content" /></div>' },
  Skeleton: { template: '<div class="p-skeleton" />' },
  Tag: { template: '<span class="p-tag"><slot /></span>' },
  Rating: { template: '<div class="p-rating" />' },
  Button: { template: '<button class="p-button" @click="$emit(\'click\')"><slot /></button>' },
}

import ResponsablePedaDashboard from '@/pages/dashboard/ResponsablePedaDashboard.vue'

describe('ResponsablePedaDashboard', () => {
  beforeEach(() => {
    mockDashboard.data.value = null
    mockDashboard.loading.value = false
    mockDashboard.error.value = null
    mockDashboard.isRateLimited.value = false
    mockDashboard.rateLimitSeconds.value = 0
    mockDashboard.load.mockResolvedValue(undefined)
  })

  it('shows skeleton while loading', () => {
    mockDashboard.loading.value = true
    const wrapper = mount(ResponsablePedaDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.p-skeleton').length).toBeGreaterThan(0)
  })

  it('renders KPI data correctly', () => {
    mockDashboard.data.value = {
      kpis: {
        totalEnrollments: 42,
        activeEnrollments: 20,
        completedEnrollments: 15,
        avgCompletionRate: 80.0,
        avgGrade: 14.5,
      },
      pendingEnrollments: [],
      recentFeedbacks: [],
    } as never
    const wrapper = mount(ResponsablePedaDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain('42')
    expect(wrapper.text()).toContain('80.0 %')
  })

  it('shows error banner with retry on 5xx', () => {
    mockDashboard.error.value = 'Impossible de charger le tableau de bord.'
    const wrapper = mount(ResponsablePedaDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-error').exists()).toBe(true)
    expect(wrapper.find('.p-button').exists()).toBe(true)
  })

  it('shows 429 throttle warning', () => {
    mockDashboard.isRateLimited.value = true
    mockDashboard.rateLimitSeconds.value = 45
    mockDashboard.error.value = 'Trop de requêtes. Réessayez dans 45 secondes.'
    const wrapper = mount(ResponsablePedaDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-warn').text()).toContain('45s')
  })
})
