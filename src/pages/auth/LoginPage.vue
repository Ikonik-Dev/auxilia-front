<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const emailInputRef = ref<HTMLInputElement | null>(null)

onMounted(() => {
  document.title = 'Connexion — Auxilium'
})

async function handleLogin() {
  if (!email.value || !password.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    await router.push({ name: 'dashboard' })
  } catch {
    errorMessage.value = 'Email ou mot de passe incorrect.'
    await nextTick()
    emailInputRef.value?.focus()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <div class="login-card">
      <!-- Header -->
      <div class="login-header">
        <div class="logo-wrap">
          <i class="pi pi-graduation-cap logo-icon" />
        </div>
        <h1 class="login-title">Auxilium</h1>
        <p class="login-subtitle">Plateforme de gestion des formations</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <!-- Error banner -->
        <div
          v-if="errorMessage"
          id="login-error"
          class="error-banner"
          role="alert"
          aria-live="polite"
        >
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          {{ errorMessage }}
        </div>

        <!-- Email -->
        <div class="field">
          <label for="email">Adresse email</label>
          <InputText
            id="email"
            ref="emailInputRef"
            v-model="email"
            type="email"
            placeholder="votre@email.com"
            autocomplete="username"
            :disabled="loading"
            :aria-describedby="errorMessage ? 'login-error' : undefined"
            fluid
          />
        </div>

        <!-- Password -->
        <div class="field">
          <label for="password">Mot de passe</label>
          <Password
            id="password"
            v-model="password"
            :feedback="false"
            autocomplete="current-password"
            :disabled="loading"
            placeholder="••••••••"
            :aria-describedby="errorMessage ? 'login-error' : undefined"
            fluid
          />
        </div>

        <!-- Submit -->
        <Button
          type="submit"
          label="Se connecter"
          icon="pi pi-arrow-right"
          icon-pos="right"
          :loading="loading"
          :aria-busy="loading"
          class="submit-btn"
          fluid
        />
      </form>

      <!-- Divider decoration -->
      <div class="card-footer">
        <span class="footer-dot" />
        <span class="footer-dot" />
        <span class="footer-dot" />
      </div>
    </div>
  </AuthLayout>
</template>

<style scoped>
/* Glass card */
.login-card {
  width: 100%;
  max-width: 420px;
  background: rgba(255, 255, 255, 0.60);
  backdrop-filter: blur(28px) saturate(200%);
  -webkit-backdrop-filter: blur(28px) saturate(200%);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  padding: 2.75rem 2.25rem 2rem;
  box-shadow:
    0 8px 40px rgba(139, 92, 246, 0.13),
    0 2px 8px  rgba(139, 92, 246, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

/* Header */
.login-header {
  text-align: center;
  margin-bottom: 2.25rem;
}

.logo-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
  border-radius: 20px;
  margin-bottom: 1.25rem;
  box-shadow: 0 6px 24px rgba(139, 92, 246, 0.35);
}

.logo-icon {
  font-size: 1.7rem;
  color: #fff;
}

.login-title {
  font-size: 1.875rem;
  font-weight: 700;
  color: #4c1d95;
  margin: 0 0 0.35rem;
  letter-spacing: -0.025em;
}

.login-subtitle {
  color: #7c6fa0;
  font-size: 0.875rem;
  margin: 0;
  font-weight: 400;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.error-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.45);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field label {
  font-size: 0.7rem;
  font-weight: 700;
  color: #5b21b6;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Submit button override */
:deep(.submit-btn.p-button) {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%) !important;
  border: none !important;
  border-radius: 14px !important;
  padding: 0.85rem 1.5rem !important;
  font-weight: 600 !important;
  font-size: 0.9375rem !important;
  box-shadow: 0 4px 22px rgba(139, 92, 246, 0.38);
  transition: all 0.22s ease !important;
  margin-top: 0.25rem;
}

:deep(.submit-btn.p-button:hover:not(:disabled)) {
  background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 30px rgba(139, 92, 246, 0.48);
}

:deep(.submit-btn.p-button:active) {
  transform: translateY(0) !important;
}

/* Decorative footer */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 1.75rem;
}

.footer-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  opacity: 0.6;
}

.footer-dot:nth-child(2) {
  width: 8px;
  height: 8px;
  opacity: 0.9;
}
</style>
