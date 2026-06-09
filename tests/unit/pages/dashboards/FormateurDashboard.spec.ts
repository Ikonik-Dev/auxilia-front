import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api', () => ({
  apiDashboardformateurGet: vi.fn(),
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
  DataTable: { template: '<table class="p-datatable"><slot /></table>' },
  Column: { template: '<col />' },
  Tag: { template: '<span class="p-tag"><slot /></span>' },
  Button: { template: '<button class="p-button" @click="$emit(\'click\')"><slot /></button>' },
}

import FormateurDashboard from '@/pages/dashboard/FormateurDashboard.vue'

describe('FormateurDashboard', () => {
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
    const wrapper = mount(FormateurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.p-skeleton').length).toBeGreaterThan(0)
  })

  it('renders KPI cards with session count', async () => {
    mockDashboard.data.value = {
      mySessions: [{ id: 1, name: 'S1', formationTitle: 'F1', startDate: null, endDate: null, status: 'active', participantCount: 10 }],
      recentAttendances: [],
      pendingEnrollments: [],
      pendingEnrollmentsCount: 0,
    } as never
    const wrapper = mount(FormateurDashboard, { global: { stubs: globalStubs } })
    // 1 session → stat-value "1"
    expect(wrapper.text()).toContain('1')
  })

  it('shows error banner on failure', () => {
    mockDashboard.error.value = 'Impossible de charger le tableau de bord.'
    const wrapper = mount(FormateurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-error').exists()).toBe(true)
    expect(wrapper.find('.p-button').exists()).toBe(true)
  })

  it('shows 429 warning and not error banner', () => {
    mockDashboard.isRateLimited.value = true
    mockDashboard.rateLimitSeconds.value = 60
    mockDashboard.error.value = 'Trop de requêtes. Réessayez dans 60 secondes.'
    const wrapper = mount(FormateurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-warn').exists()).toBe(true)
    expect(wrapper.find('.dash-error').exists()).toBe(false)
  })
})
