import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// Stub heavy deps
vi.mock('chart.js', () => ({
  Chart: class {
    static register() {}
    destroy() {}
  },
  LineController: {},
  LineElement: {},
  PointElement: {},
  LinearScale: {},
  CategoryScale: {},
  Tooltip: {},
  Filler: {},
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/api', () => ({
  apiDashboarddirecteurGet: vi.fn(),
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

// PrimeVue stubs
const globalStubs = {
  Card: { template: '<div class="p-card"><slot name="content" /></div>' },
  Skeleton: { template: '<div class="p-skeleton" />' },
  DataTable: { template: '<table class="p-datatable"><slot /></table>' },
  Column: { template: '<col />' },
  Tag: { template: '<span class="p-tag"><slot /></span>' },
  Button: { template: '<button class="p-button" @click="$emit(\'click\')"><slot /></button>' },
}

import DirecteurDashboard from '@/pages/dashboard/DirecteurDashboard.vue'

describe('DirecteurDashboard', () => {
  beforeEach(() => {
    mockDashboard.data.value = null
    mockDashboard.loading.value = false
    mockDashboard.error.value = null
    mockDashboard.isRateLimited.value = false
    mockDashboard.rateLimitSeconds.value = 0
    mockDashboard.load.mockResolvedValue(undefined)
  })

  it('shows skeleton cards while loading', () => {
    mockDashboard.loading.value = true
    const wrapper = mount(DirecteurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.findAll('.p-skeleton').length).toBeGreaterThan(0)
  })

  it('renders KPI cards with real data', async () => {
    mockDashboard.data.value = {
      globalKpis: {
        totalFormations: 12,
        totalUsers: 88,
        activeEnrollments: 34,
        avgCompletionRate: 72.5,
      },
      topFormations: [],
      periodTrends: [],
    } as never
    const wrapper = mount(DirecteurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('88')
  })

  it('shows error banner and retry button on failure', async () => {
    mockDashboard.error.value = 'Impossible de charger le tableau de bord.'
    const wrapper = mount(DirecteurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.find('.p-button').exists()).toBe(true)
  })

  it('shows rate-limit warning (429) without retry button', async () => {
    mockDashboard.isRateLimited.value = true
    mockDashboard.rateLimitSeconds.value = 30
    mockDashboard.error.value = 'Trop de requêtes. Réessayez dans 30 secondes.'
    const wrapper = mount(DirecteurDashboard, { global: { stubs: globalStubs } })
    expect(wrapper.find('.dash-warn').exists()).toBe(true)
    expect(wrapper.find('.dash-error').exists()).toBe(false)
  })
})
