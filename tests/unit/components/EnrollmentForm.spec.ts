import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

/**
 * Chantier A4 — le formulaire de création ne peut plus proposer une liste tronquée
 * (16 septembre 2026).
 *
 * ⚠ CE FICHIER GARDE LE CŒUR DU LOT. Avant, `apiUsersGetCollection()` sans paramètre rendait la
 * page 1 : 18, 20 ou 23 stagiaires sélectionnables sur 41 selon le compte. Avec
 * `force-selection`, les autres n'étaient pas saisissables, et une boîte ACTIVE qui ne propose
 * rien affirme « ce nom n'existe pas ». Ces tests exigent l'inverse : champs désactivés tant que
 * la lecture n'est pas complète.
 */

const apiUsersGetCollection    = vi.fn()
const apiSessionsGetCollection = vi.fn()

vi.mock('@/api', () => ({
  apiUsersGetCollection:    (...a: unknown[]) => apiUsersGetCollection(...a),
  apiSessionsGetCollection: (...a: unknown[]) => apiSessionsGetCollection(...a),
}))

import EnrollmentForm from '@/components/inscriptions/EnrollmentForm.vue'

function stagiaires(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, firstName: 'Sta', lastName: `G${i + 1}`, email: `s${i + 1}@auxilium.test`, isActive: true,
  }))
}

function sessions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, name: `S${i + 1}`, status: 'planned', formation: { title: 'F' },
  }))
}

function ld(membres: unknown[], total = membres.length) {
  return { data: { member: membres, totalItems: total }, error: undefined }
}

function monter() {
  return mount(EnrollmentForm, {
    global: {
      stubs: {
        // Enveloppes qui exposent ce que les assertions lisent : l'état désactivé et les suggestions.
        AutoComplete: {
          name: 'AutoComplete',
          props: ['disabled', 'suggestions', 'modelValue'],
          emits: ['complete'],
          template: '<input class="ac" :disabled="disabled" />',
        },
        Select: {
          props: ['disabled', 'options', 'modelValue'],
          template: '<select class="sel" :disabled="disabled" />',
        },
        Button: {
          props: ['disabled', 'label', 'loading'],
          template: '<button :disabled="disabled">{{ label }}</button>',
        },
        Textarea: true,
        Tag: true,
      },
    },
  })
}

describe('EnrollmentForm — aucune suggestion tant que les listes ne sont pas lues en entier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiSessionsGetCollection.mockResolvedValue(ld(sessions(12)))
  })

  it('demande le plafond pour les utilisateurs, et rien de plus pour les sessions', async () => {
    apiUsersGetCollection.mockResolvedValue(ld(stagiaires(41)))
    monter()
    await flushPromises()

    expect(apiUsersGetCollection).toHaveBeenCalledWith({
      query: { itemsPerPage: 100 },
      headers: { Accept: 'application/ld+json' },
    })
    expect(apiSessionsGetCollection).toHaveBeenCalledWith({
      headers: { Accept: 'application/ld+json' },
    })
  })

  it('propose les 41 stagiaires quand la lecture est complète', async () => {
    apiUsersGetCollection.mockResolvedValue(ld(stagiaires(41)))
    const w = monter()
    await flushPromises()

    const ac = w.findComponent({ name: 'AutoComplete' })
    expect(ac.props('disabled')).toBe(false)
    expect(w.find('[role="alert"]').exists()).toBe(false)

    ac.vm.$emit('complete', { query: 'sta' })
    await flushPromises()
    expect(ac.props('suggestions')).toHaveLength(41)
  })

  // ── LE CŒUR DU LOT ─────────────────────────────────────────────────────────────────

  it('DÉSACTIVE la saisie et affiche une alerte sur 30 utilisateurs reçus pour 53 annoncés', async () => {
    apiUsersGetCollection.mockResolvedValue(ld(stagiaires(30), 53))
    const w = monter()
    await flushPromises()

    const ac = w.findComponent({ name: 'AutoComplete' })
    expect(ac.props('disabled')).toBe(true)
    expect(w.find('.sel').attributes('disabled')).toBeDefined()
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeDefined()

    const alerte = w.find('[role="alert"]')
    expect(alerte.exists()).toBe(true)
    expect(alerte.text()).toContain('53')

    // Et surtout PAS une boîte active qui ne propose rien.
    ac.vm.$emit('complete', { query: 'sta' })
    await flushPromises()
    expect(ac.props('suggestions') ?? []).toHaveLength(0)
  })

  it('garde les champs désactivés PENDANT le chargement', async () => {
    let resoudre: (v: unknown) => void = () => {}
    apiUsersGetCollection.mockReturnValue(new Promise((r) => { resoudre = r }))
    const w = monter()
    await flushPromises()

    expect(w.findComponent({ name: 'AutoComplete' }).props('disabled')).toBe(true)

    resoudre(ld(stagiaires(41)))
    await flushPromises()
    expect(w.findComponent({ name: 'AutoComplete' }).props('disabled')).toBe(false)
  })
})

// ══ Chantier A6 — le bandeau d'échec n'invente plus de motif (16 septembre 2026) ════════════

describe("EnrollmentForm — le bandeau affiche le message reçu, et rien d'autre", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiUsersGetCollection.mockResolvedValue(ld(stagiaires(41)))
    apiSessionsGetCollection.mockResolvedValue(ld(sessions(12)))
  })

  function monterAvec(saveError: string) {
    return mount(EnrollmentForm, {
      props: { saveError },
      global: { stubs: { AutoComplete: true, Select: true, Button: true, Textarea: true, Tag: true } },
    })
  }

  it("affiche le motif traduit tel quel", async () => {
    const w = monterAvec("Ce stagiaire est déjà inscrit à cette session.")
    await flushPromises()

    expect(w.find("[role=\"alert\"]").text()).toBe("Ce stagiaire est déjà inscrit à cette session.")
  })

  it("ne traduit PLUS la chaîne « 422 » en « Capacité maximale atteinte »", async () => {
    const w = monterAvec("422")
    await flushPromises()

    expect(w.text()).not.toContain("Capacité maximale")
  })
})
