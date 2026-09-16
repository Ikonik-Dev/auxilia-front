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

// ⚠ `importOriginal` et non un bouchon complet : la page fait `e instanceof EchecInscription`.
// Bouchonner le module entier laisserait `EchecInscription` à `undefined`, et une doublure de la
// classe testerait la doublure. Seul `useInscriptions` est remplacé ; la classe est la vraie.
vi.mock('@/composables/useInscriptions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/composables/useInscriptions')>()),
  useInscriptions: () => etat,
}))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasRole: (r: string) => r === 'ROLE_RESPONSABLE_PED' }),
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))
vi.mock('@/api', () => ({
  apiEnrollmentsGetCollection: vi.fn(),
  apiEnrollmentsPost:          vi.fn(),
  apiEnrollmentsIdPut:         vi.fn(),
  apiEnrollmentsIdDelete:      vi.fn(),
}))

import Inscriptions from '@/pages/inscriptions/index.vue'
import EnrollmentForm from '@/components/inscriptions/EnrollmentForm.vue'
import { EchecInscription } from '@/composables/useInscriptions'
import { flushPromises } from '@vue/test-utils'

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

// ══ Chantier A6 — l'envoi du formulaire (16 septembre 2026) ═════════════════════════════════

/** Monte la page avec un Dialog qui rend son contenu, pour atteindre le formulaire. */
function monterAvecFormulaire() {
  return mount(Inscriptions, {
    global: {
      stubs: {
        Toast: true, InputText: true, Select: true, Column: true, Tag: true, ProgressBar: true, Skeleton: true,
        EnrollmentForm: true,
        Dialog: { template: '<div><slot /></div>' },
        Button: { props: ['disabled', 'label'], template: '<button :disabled="disabled">{{ label }}</button>' },
        DataTable: { props: ['value'], template: '<div class="dt" />' },
      },
    },
  })
}

describe('/inscriptions — l\'échec d\'une création affiche le motif juste, et relit la liste s\'il le faut', () => {
  beforeEach(() => {
    etat.inscriptions.value = []
    etat.loading.value = false
    etat.error.value = null
    vi.clearAllMocks()
  })

  async function soumettre(echec: EchecInscription) {
    etat.createInscription.mockRejectedValue(echec)
    const w = monterAvecFormulaire()
    await flushPromises()
    etat.fetchInscriptions.mockClear() // l'appel du montage ne compte pas

    w.findComponent(EnrollmentForm).vm.$emit('submit', { user: '/api/users/1', session: '/api/sessions/1' })
    await flushPromises()
    return w
  }

  it('transmet au formulaire le message DÉJÀ TRADUIT, et relit la liste après un doublon', async () => {
    const w = await soumettre(new EchecInscription('Ce stagiaire est déjà inscrit à cette session.', true))

    expect(w.findComponent(EnrollmentForm).props('saveError')).toBe('Ce stagiaire est déjà inscrit à cette session.')
    expect(etat.fetchInscriptions).toHaveBeenCalledTimes(1)
  })

  it('relit la liste après un 500 — l\'inscription a pu être enregistrée', async () => {
    await soumettre(new EchecInscription('Erreur du serveur. L\'inscription a pu être enregistrée : vérifiez la liste avant de réessayer.', true))

    expect(etat.fetchInscriptions).toHaveBeenCalledTimes(1)
  })

  it('NE relit PAS la liste quand rien n\'a pu changer (422, session complète, 429)', async () => {
    const w = await soumettre(new EchecInscription('Cette session est complète.', false))

    expect(w.findComponent(EnrollmentForm).props('saveError')).toBe('Cette session est complète.')
    expect(etat.fetchInscriptions).not.toHaveBeenCalled()
  })

  it('ne transmet JAMAIS la chaîne « 422 » au formulaire', async () => {
    const w = await soumettre(new EchecInscription('Inscription incomplète : choisissez un stagiaire et une session.', false))

    expect(w.findComponent(EnrollmentForm).props('saveError')).not.toBe('422')
  })
})
