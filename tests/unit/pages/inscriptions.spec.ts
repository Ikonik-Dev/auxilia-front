import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

/**
 * Chantier A4 — la page ne propose pas de créer une inscription sans voir les existantes
 * (16 septembre 2026).
 *
 * ⚠ LE MOTIF EST UN HTTP 500, PAS DE LA PRUDENCE. Un doublon (user, session) viole
 * `unique_user_session` sans aucun garde en amont — mesuré par
 * `auxilia-api/tests/Functional/Security/EnrollmentCollectionTest.php`. Tant que la liste n'est
 * pas lue en entier, on ne peut pas savoir si la personne est déjà inscrite.
 */

const etat = {
  inscriptions:        ref<unknown[]>([]),
  loading:             ref(false),
  error:               ref<string | null>(null),
  fetchInscriptions:   vi.fn(),
  createInscription:   vi.fn(),
  validateInscription: vi.fn(),
  deleteInscription:   vi.fn(),
}

vi.mock('@/composables/useInscriptions', () => ({ useInscriptions: () => etat }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasRole: (r: string) => r === 'ROLE_RESPONSABLE_PED' }),
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('@/api', () => ({}))

import Inscriptions from '@/pages/inscriptions/index.vue'

function monter() {
  return mount(Inscriptions, {
    global: {
      stubs: {
        Toast: true, Dialog: true, EnrollmentForm: true, InputText: true, Select: true,
        Column: true, Tag: true, ProgressBar: true, Skeleton: true,
        Button: {
          props: ['disabled', 'label'],
          template: '<button :disabled="disabled">{{ label }}</button>',
        },
        DataTable: {
          props: ['value'],
          template: '<div class="dt"><slot v-if="!value || value.length === 0" name="empty" /></div>',
        },
      },
    },
  })
}

function boutonCreer(w: ReturnType<typeof monter>) {
  const b = w.findAll('button').find((x) => x.text() === 'Nouvelle inscription')
  expect(b, 'bouton « Nouvelle inscription » absent').toBeDefined()
  return b!
}

describe('/inscriptions — créer suppose d\'avoir lu toutes les inscriptions', () => {
  beforeEach(() => {
    etat.inscriptions.value = []
    etat.loading.value = false
    etat.error.value = null
  })

  it('DÉSACTIVE « Nouvelle inscription » et masque la table quand la lecture a échoué', () => {
    etat.error.value = 'Inscriptions : 30 éléments reçus sur 47 annoncés. La lecture est incomplète.'

    const w = monter()

    expect(boutonCreer(w).attributes('disabled')).toBeDefined()
    expect(w.find('[role="alert"]').text()).toContain('47')
    expect(w.text()).not.toContain('Aucune inscription trouvée')
    expect(w.text()).not.toContain('en attente')
  })

  it('active le bouton quand la lecture a réussi', () => {
    etat.inscriptions.value = [{ id: 1, status: 'active', user: { firstName: 'A', lastName: 'B' }, session: { name: 'S' } }]

    expect(boutonCreer(monter()).attributes('disabled')).toBeUndefined()
  })

  it('désactive le bouton pendant le chargement', () => {
    etat.loading.value = true

    expect(boutonCreer(monter()).attributes('disabled')).toBeDefined()
  })
})
