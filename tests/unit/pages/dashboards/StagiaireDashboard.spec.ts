import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/api', () => ({
  apiDashboardstagiaireGet: vi.fn(),
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
  ProgressBar: { template: '<div class="p-progressbar" />' },
  Tag: { template: '<span class="p-tag"><slot /></span>' },
  Button: { template: '<button class="p-button" @click="$emit(\'click\')"><slot /></button>' },
}

import StagiaireDashboard from '@/pages/dashboard/StagiaireDashboard.vue'

describe('StagiaireDashboard', () => {
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
    const wrapper = mount(StagiaireDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.p-skeleton').length).toBeGreaterThan(0)
  })

  it('renders active enrollment with progress bar', () => {
    mockDashboard.data.value = {
      activeEnrollments: [
        {
          id: 1,
          formationTitle: 'Formation React',
          sessionName: 'Session A',
          status: 'active',
          progress: '65',
          sessionDates: { startDate: '2026-06-01', endDate: '2026-07-01' },
        },
      ],
      upcomingSchedules: [],
      todayStats: null,
    } as never
    const wrapper = mount(StagiaireDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain('Formation React')
    expect(wrapper.find('.p-progressbar').exists()).toBe(true)
  })

  it('shows error banner with retry on network error', () => {
    mockDashboard.error.value = 'Impossible de charger le tableau de bord.'
    const wrapper = mount(StagiaireDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-error').exists()).toBe(true)
    expect(wrapper.find('.p-button').exists()).toBe(true)
  })

  it('shows 429 warning without retry button', () => {
    mockDashboard.isRateLimited.value = true
    mockDashboard.rateLimitSeconds.value = 60
    mockDashboard.error.value = 'Trop de requêtes. Réessayez dans 60 secondes.'
    const wrapper = mount(StagiaireDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-warn').exists()).toBe(true)
    expect(wrapper.find('.dash-error').exists()).toBe(false)
  })
})
