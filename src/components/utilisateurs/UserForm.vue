<script setup lang="ts">
import { ref, watch } from 'vue'
import type { UserUserRead } from '@/api'
import type { UserFormPayload } from '@/composables/useUtilisateurs'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'

const props = defineProps<{
  user?: UserUserRead | null
  saving?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  submit: [payload: UserFormPayload & { password?: string }]
  cancel: []
}>()

const isEdit = !!props.user

// ── Form state ──
const firstName = ref('')
const lastName  = ref('')
const email     = ref('')
const password  = ref('')
const phone     = ref('')
const isActive  = ref(true)
const roles     = ref<string[]>([])

const ROLE_OPTIONS = [
  { label: 'Admin',                value: 'ROLE_ADMIN' },
  { label: 'Directeur',            value: 'ROLE_DIRECTEUR' },
  { label: 'Formateur',            value: 'ROLE_FORMATEUR' },
  { label: 'Responsable péda.',    value: 'ROLE_RESPONSABLE_PED' },
  { label: 'Stagiaire',            value: 'ROLE_USER' },
]

// ── Populate when editing ──
watch(
  () => props.user,
  (u) => {
    if (!u) return
    firstName.value = u.firstName ?? ''
    lastName.value  = u.lastName  ?? ''
    email.value     = u.email     ?? ''
    phone.value     = u.phone     ?? ''
    isActive.value  = u.isActive  ?? true
    roles.value     = (u.roles ?? []).filter((r): r is string => r !== null)
  },
  { immediate: true },
)

// ── Validation ──
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}
  if (!firstName.value.trim()) errors.value.firstName = 'Le prénom est obligatoire.'
  if (!lastName.value.trim())  errors.value.lastName  = 'Le nom est obligatoire.'
  if (!email.value.trim())     errors.value.email     = 'L\'email est obligatoire.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) errors.value.email = 'Email invalide.'
  if (!isEdit && !password.value) errors.value.password = 'Le mot de passe est obligatoire.'
  if (roles.value.length === 0)   errors.value.roles   = 'Sélectionnez au moins un rôle.'
  return Object.keys(errors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  const payload: UserFormPayload & { password?: string } = {
    firstName: firstName.value.trim(),
    lastName:  lastName.value.trim(),
    email:     email.value.trim(),
    phone:     phone.value.trim() || null,
    isActive:  isActive.value,
    roles:     roles.value,
  }
  if (password.value) payload.password = password.value
  emit('submit', payload)
}
</script>

<template>
  <form class="user-form" novalidate @submit.prevent="handleSubmit">
    <div v-if="saveError" class="form-banner-error" role="alert">
      <i class="pi pi-exclamation-circle" /> {{ saveError }}
    </div>

    <div class="form-grid">
      <!-- Prénom -->
      <div class="field">
        <label for="uf-firstname">Prénom <span class="req">*</span></label>
        <InputText id="uf-firstname" v-model="firstName" :invalid="!!errors.firstName" fluid />
        <small v-if="errors.firstName" class="field-error">{{ errors.firstName }}</small>
      </div>

      <!-- Nom -->
      <div class="field">
        <label for="uf-lastname">Nom <span class="req">*</span></label>
        <InputText id="uf-lastname" v-model="lastName" :invalid="!!errors.lastName" fluid />
        <small v-if="errors.lastName" class="field-error">{{ errors.lastName }}</small>
      </div>

      <!-- Email -->
      <div class="field field--full">
        <label for="uf-email">Adresse email <span class="req">*</span></label>
        <InputText id="uf-email" v-model="email" type="email" autocomplete="off" :invalid="!!errors.email" fluid />
        <small v-if="errors.email" class="field-error">{{ errors.email }}</small>
      </div>

      <!-- Mot de passe -->
      <div class="field field--full">
        <label for="uf-password">
          Mot de passe <span v-if="!isEdit" class="req">*</span>
          <span v-else class="optional">(laisser vide pour conserver)</span>
        </label>
        <Password
          id="uf-password"
          v-model="password"
          :feedback="!isEdit"
          :invalid="!!errors.password"
          autocomplete="new-password"
          placeholder="••••••••"
          fluid
        />
        <small v-if="errors.password" class="field-error">{{ errors.password }}</small>
      </div>

      <!-- Téléphone -->
      <div class="field">
        <label for="uf-phone">Téléphone</label>
        <InputText id="uf-phone" v-model="phone" type="tel" fluid />
      </div>

      <!-- Statut actif -->
      <div class="field field--toggle">
        <label for="uf-active">Compte actif</label>
        <ToggleSwitch id="uf-active" v-model="isActive" />
      </div>

      <!-- Rôles -->
      <div class="field field--full">
        <label for="uf-roles">Rôles <span class="req">*</span></label>
        <MultiSelect
          id="uf-roles"
          v-model="roles"
          :options="ROLE_OPTIONS"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner un ou plusieurs rôles"
          :invalid="!!errors.roles"
          display="chip"
          fluid
        />
        <small v-if="errors.roles" class="field-error">{{ errors.roles }}</small>
      </div>
    </div>

    <div class="form-actions">
      <Button type="button" label="Annuler" severity="secondary" text :disabled="saving" @click="emit('cancel')" />
      <Button
        type="submit"
        :label="user ? 'Enregistrer' : 'Créer l\'utilisateur'"
        icon="pi pi-check"
        :loading="saving"
      />
    </div>
  </form>
</template>

<style scoped>
.user-form {
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
  font-weight: 500;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field--full { grid-column: 1 / -1; }

.field--toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(196, 181, 253, 0.3);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b21b6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.req { color: #b91c1c; margin-left: 2px; }
.optional { color: #6b7280; font-weight: 400; text-transform: none; letter-spacing: 0; }
.field-error { color: #b91c1c; font-size: 0.75rem; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
}
</style>
