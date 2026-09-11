import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, ref } from 'vue'

/**
 * Chantier A3 — la phrase « Tout est noté » ne doit pas être affichable sur une lecture
 * incomplète (12 septembre 2026).
 *
 * ⚠ CE FICHIER EXISTE PARCE QU'UNE INFÉRENCE NE DEVAIT PAS RESTER UNE INFÉRENCE. Le
 * scénario — noter la seule copie visible, puis voir l'écran déclarer « Tout est noté »
 * pendant que quatre copies attendent — ne pouvait pas être mesuré à l'écran sans écrire
 * en base de démonstration. Il se mesure ici, composable bouchonné, sans aucune base.
 *
 * Avant ce lot, `#empty` se déclenchait sur une liste vide QUELLE QUE SOIT LA CAUSE :
 * page tronquée, filtre abandonné par le serveur, ou file réellement vide. Un écran qui
 * dit « il n'y a rien » dit au correcteur d'arrêter de chercher.
 */

const PHRASE = 'Tout est noté'

// `erreurCopies` est déclarée à part : la référencer depuis l'objet qui la contient
// rendrait `etat` implicitement `any` (TS7022), et le type-check est une porte.
const erreurCopies = ref<string | null>(null)

const etat = {
  evaluations:           ref<unknown[]>([]),
  pendingGrading:        ref<unknown[]>([]),
  loading:               ref(false),
  error:                 ref<string | null>(null),
  erreurCopies,
  lectureCopiesReussie:  computed(() => erreurCopies.value === null),
  fetchEvaluations:      vi.fn(),
  gradeSubmission:       vi.fn(),
}

vi.mock('@/composables/useEvaluations', () => ({
  useEvaluations: () => etat,
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasRole: (r: string) => r === 'ROLE_FORMATEUR' }),
}))

vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))

vi.mock('@/api', () => ({}))

import Evaluations from '@/pages/evaluations/index.vue'

function monter() {
  return mount(Evaluations, {
    global: {
      stubs: {
        Toast: true,
        // ⚠ Les composants d'onglets PrimeVue sont remplacés par des enveloppes qui
        // RENDENT LEURS SLOTS : les stubber (`true`) masquerait le badge et le panneau,
        // et les laisser réels exige le plugin PrimeVue (`TabList` lit `$primevue.config`).
        // Les deux panneaux sont donc rendus simultanément, ce qui convient ici : les
        // assertions portent sur la présence d'une phrase et d'un badge, pas sur l'onglet actif.
        Tabs:      { template: '<div><slot /></div>' },
        TabList:   { template: '<div><slot /></div>' },
        Tab:       { template: '<div><slot /></div>' },
        TabPanels: { template: '<div><slot /></div>' },
        TabPanel:  { template: '<div><slot /></div>' },
        DataTable: {
          props: ['value'],
          template: '<div class="dt"><slot v-if="!value || value.length === 0" name="empty" /></div>',
        },
        Column: true, Tag: true, Button: true, Dialog: true,
        InputNumber: true, Textarea: true, Skeleton: true,
      },
    },
  })
}

describe('/evaluations — « Tout est noté » n\'est dicible que sur une lecture complète', () => {
  beforeEach(() => {
    etat.evaluations.value = []
    etat.pendingGrading.value = []
    etat.loading.value = false
    etat.error.value = null
    etat.erreurCopies.value = null
  })

  // ── LE CŒUR DU LOT ───────────────────────────────────────────────────────────────────
  //
  // ⚠ CE TEST EST CE QUI GARDE LE CORRECTIF. Rendre `#empty` inconditionnel — c'est-à-dire
  // retirer le `v-if="erreurCopies"` qui écarte la table — le fait tomber.

  it('NE rend PAS « Tout est noté » quand la lecture de la file a échoué', () => {
    etat.pendingGrading.value = []
    etat.erreurCopies.value =
      'Copies à noter : 30 éléments reçus sur 55 annoncés. Impossible de savoir combien de copies attendent.'

    const w = monter()

    expect(w.text()).not.toContain(PHRASE)
    expect(w.find('[role="alert"]').exists()).toBe(true)
    expect(w.find('[role="alert"]').text()).toContain('55')
  })

  it('rend « Tout est noté » quand la lecture a réussi et que la file est vide', () => {
    etat.pendingGrading.value = []
    etat.erreurCopies.value = null

    const w = monter()

    // L'invariant de lireCollectionComplete (membres.length === total) rend ce cas
    // équivalent à « le serveur annonce zéro » : aucun second nombre n'est lu.
    expect(w.text()).toContain(PHRASE)
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  // ── Le badge, qui portait le « 1 pour 5 » ────────────────────────────────────────────

  it('n\'affiche AUCUN badge quand la lecture a échoué, plutôt qu\'un compte de page', () => {
    etat.pendingGrading.value = [{ id: 1, status: 'pending_review' }]
    etat.erreurCopies.value = 'Lecture incomplète.'

    expect(monter().find('.tab-badge').exists()).toBe(false)
  })

  it('affiche le badge quand la lecture a réussi', () => {
    etat.pendingGrading.value = [
      { id: 1, status: 'pending_review' },
      { id: 2, status: 'pending_review' },
    ]
    etat.erreurCopies.value = null

    const badge = monter().find('.tab-badge')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toBe('2')
  })
})
