<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiUsersGetCollection, apiSessionsGetCollection } from '@/api'
import {
  ErreurCollection,
  PLAFOND_ITEMS_PAR_PAGE,
  lireCollectionComplete,
  lireCollectionSousPlafond,
} from '@/api/collection'
import type { UserUserRead, SessionSessionRead, EnrollmentEnrollmentWrite } from '@/api'
import AutoComplete from 'primevue/autocomplete'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Button from 'primevue/button'
import Tag from 'primevue/tag'

const props = defineProps<{
  saving?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  submit: [payload: EnrollmentEnrollmentWrite]
  cancel: []
}>()

// ── Data ──
const allUsers    = ref<UserUserRead[]>([])
const allSessions = ref<SessionSessionRead[]>([])

/**
 * ⚠ CE FORMULAIRE NE PROPOSAIT QUE LA PREMIÈRE PAGE DES UTILISATEURS (chantier A4, 16 septembre
 * 2026). `apiUsersGetCollection()` sans paramètre rendait 30 fiches : 18, 20 ou 23 stagiaires
 * sélectionnables sur 41 selon le compte (superviseur, directeur, respeda). Avec `force-selection`,
 * un stagiaire absent de la liste ne pouvait pas être saisi — et rien ne distinguait « pas encore
 * chargé » ou « hors de la page » de « n'existe pas ».
 *
 * D'où la règle de ce composant : TANT QUE LES LISTES NE SONT PAS LUES EN ENTIER, LES CHAMPS
 * SONT DÉSACTIVÉS. Une boîte grisée dit « je ne sais pas » ; une boîte active qui ne propose rien
 * dit « il n'existe pas ». Seule la première est vraie.
 */
const chargementListes = ref(true)
const erreurListes     = ref<string | null>(null)
const listesPretes     = computed(() => !chargementListes.value && erreurListes.value === null)

onMounted(async () => {
  try {
    const [usersRes, sessionsRes] = await Promise.all([
      apiUsersGetCollection({
        query: { itemsPerPage: PLAFOND_ITEMS_PAR_PAGE },
        headers: { Accept: 'application/ld+json' },
      }),
      // ⚠ PAS D'itemsPerPage ICI, et ce n'est pas un oubli : `Session` ne déclare pas
      // `paginationClientItemsPerPage`, le paramètre serait ignoré. 12 sessions sur 12 sont lues
      // aujourd'hui — cette garde ne change RIEN à l'affichage actuel. Son plafond implicite est
      // 30, pas 100 : à la 31e session elle lèvera plutôt que de tronquer (dette 🟡 LATENTE).
      apiSessionsGetCollection({ headers: { Accept: 'application/ld+json' } }),
    ])
    if (usersRes.error || sessionsRes.error) {
      throw new ErreurCollection("Le serveur n'a pas rendu la liste des stagiaires ou des sessions.")
    }

    allUsers.value = lireCollectionSousPlafond<UserUserRead>(usersRes.data, 'Utilisateurs')
      .filter((u) => u.isActive)
    allSessions.value = lireCollectionComplete<SessionSessionRead>(sessionsRes.data, 'Sessions')
      .filter((s) => s.status !== 'cancelled')
  } catch (e) {
    // ⚠ FAIL CLOSED : aucune suggestion partielle.
    allUsers.value = []
    allSessions.value = []
    erreurListes.value = e instanceof ErreurCollection
      ? e.message
      : 'Impossible de charger les stagiaires et les sessions.'
  } finally {
    chargementListes.value = false
  }
})

// ── Enriched user type for AutoComplete display ──
type UserOption = UserUserRead & { displayLabel: string }

// ── Form state ──
const selectedUser    = ref<UserOption | null>(null)
const selectedSession = ref<SessionSessionRead | null>(null)
const notes           = ref('')
const userSuggestions = ref<UserOption[]>([])

function toUserOption(u: UserUserRead): UserOption {
  return { ...u, displayLabel: `${u.firstName} ${u.lastName} — ${u.email}` }
}

// ── AutoComplete user ──
function searchUser(event: { query: string }) {
  const q = event.query.toLowerCase()
  userSuggestions.value = allUsers.value
    .filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    )
    .map(toUserOption)
}

// ── Session options ──
const sessionOptions = computed(() =>
  allSessions.value.map((s) => ({
    label: `${s.formation.title} · ${s.name}`,
    value: s,
    capacity: s.maxParticipants,
    mode: s.mode,
  })),
)

// ── Validation ──
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}
  if (!selectedUser.value?.id) errors.value.user    = 'Sélectionnez un stagiaire.'
  if (!selectedSession.value) errors.value.session = 'Sélectionnez une session.'
  return Object.keys(errors.value).length === 0
}

function handleSubmit() {
  if (!listesPretes.value) return
  if (!validate()) return
  const payload: EnrollmentEnrollmentWrite = {
    user:               `/api/users/${selectedUser.value!.id}`,
    session:            `/api/sessions/${selectedSession.value!.id}`,
    status:             'pending',
    progressPercentage: '0',
    certificateIssued:  false,
    enrollmentDate:     new Date().toISOString().split('T')[0],
    startDate:          null,
    completionDate:     null,
    notes:              notes.value.trim() || null,
  }
  emit('submit', payload)
}
</script>

<template>
  <form class="enrollment-form" novalidate @submit.prevent="handleSubmit">
    <!-- ⚠ Chantier A6 : ce bandeau traduisait lui-même la chaîne '422' en « Capacité maximale
         atteinte » — sur une erreur de validation, jamais sur la capacité (un 409). Il affiche
         désormais le message déjà traduit par echecInscription() (useInscriptions.ts), et rien
         d'autre : aucun texte d'erreur ne vit plus ici. -->
    <div v-if="saveError" class="form-banner-error" role="alert">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <span>{{ saveError }}</span>
    </div>

    <div v-if="erreurListes" class="form-banner-error" role="alert">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      <span>{{ erreurListes }} Impossible de créer une inscription tant que ces listes sont incomplètes.</span>
    </div>

    <div class="form-fields">
      <!-- Stagiaire -->
      <div class="field">
        <label for="ef-user">Stagiaire <span class="req">*</span></label>
        <AutoComplete
          id="ef-user"
          v-model="selectedUser"
          :suggestions="userSuggestions"
          option-label="displayLabel"
          :invalid="!!errors.user"
          :disabled="!listesPretes"
          :placeholder="chargementListes ? 'Chargement des stagiaires…' : 'Rechercher par nom ou email…'"
          force-selection
          fluid
          @complete="searchUser"
        >
          <template #option="{ option }">
            <div class="user-option">
              <div class="user-option-avatar">{{ option.firstName[0] }}{{ option.lastName[0] }}</div>
              <div>
                <div class="user-option-name">{{ option.firstName }} {{ option.lastName }}</div>
                <div class="user-option-email">{{ option.email }}</div>
              </div>
            </div>
          </template>
        </AutoComplete>
        <small v-if="errors.user" class="field-error">{{ errors.user }}</small>
      </div>

      <!-- Session -->
      <div class="field">
        <label for="ef-session">Session <span class="req">*</span></label>
        <Select
          id="ef-session"
          v-model="selectedSession"
          :options="sessionOptions"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner une session"
          :invalid="!!errors.session"
          :disabled="!listesPretes"
          fluid
        >
          <template #option="{ option }">
            <div class="session-option">
              <span class="session-option-label">{{ option.label }}</span>
              <div class="session-option-meta">
                <Tag v-if="option.capacity" :value="`${option.capacity} places max`" severity="secondary" />
                <Tag v-if="option.mode" :value="option.mode" severity="info" />
              </div>
            </div>
          </template>
        </Select>
        <small v-if="errors.session" class="field-error">{{ errors.session }}</small>
        <small v-if="selectedSession?.maxParticipants" class="field-hint">
          <i class="pi pi-info-circle" /> Capacité max : {{ selectedSession.maxParticipants }} places
        </small>
      </div>

      <!-- Notes -->
      <div class="field">
        <label for="ef-notes">Notes internes</label>
        <Textarea id="ef-notes" v-model="notes" rows="2" placeholder="Informations complémentaires…" style="width:100%" />
      </div>
    </div>

    <div class="form-actions">
      <Button type="button" label="Annuler" severity="secondary" text :disabled="saving" @click="emit('cancel')" />
      <Button type="submit" label="Créer l'inscription" icon="pi pi-check" :loading="saving" :disabled="!listesPretes" />
    </div>
  </form>
</template>

<style scoped>
.enrollment-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-banner-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.45);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.form-fields {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b21b6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.req { color: #b91c1c; margin-left: 2px; }
.field-error { color: #b91c1c; font-size: 0.75rem; }
.field-hint  { color: #675c9c; font-size: 0.75rem; }

/* AutoComplete user option */
.user-option {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.25rem 0;
}

.user-option-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  flex-shrink: 0;
}

.user-option-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e1b4b;
}

.user-option-email {
  font-size: 0.75rem;
  color: #675c9c;
}

/* Session option */
.session-option {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem 0;
}

.session-option-label {
  font-size: 0.875rem;
  color: #1e1b4b;
}

.session-option-meta {
  display: flex;
  gap: 0.375rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
}
</style>
