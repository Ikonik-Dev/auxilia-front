<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiUsersGetCollection, apiSessionsGetCollection } from '@/api'
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

onMounted(async () => {
  const [usersRes, sessionsRes] = await Promise.all([
    apiUsersGetCollection(),
    apiSessionsGetCollection(),
  ])
  allUsers.value    = (usersRes.data ?? []).filter((u) => u.isActive)
  allSessions.value = (sessionsRes.data ?? []).filter((s) => s.status !== 'cancelled')
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
    <div v-if="saveError" class="form-banner-error" role="alert">
      <i class="pi pi-exclamation-circle" />
      <span v-if="saveError === '422'">
        Capacité maximale atteinte pour cette session.
      </span>
      <span v-else>{{ saveError }}</span>
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
          placeholder="Rechercher par nom ou email…"
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
      <Button type="submit" label="Créer l'inscription" icon="pi pi-check" :loading="saving" />
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
