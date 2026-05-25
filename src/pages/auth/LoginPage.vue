<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AuthLayout from '@/layouts/AuthLayout.vue'
import Card from 'primevue/card'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Button from 'primevue/button'
import Message from 'primevue/message'

const auth = useAuthStore()
const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function handleLogin() {
  if (!email.value || !password.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.login(email.value, password.value)
    await router.push({ name: 'dashboard' })
  } catch {
    errorMessage.value = 'Email ou mot de passe incorrect.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <Card class="login-card">
      <template #header>
        <div class="login-header">
          <h1 class="login-title">Auxilia LMS</h1>
          <p class="login-subtitle">Connectez-vous à votre espace</p>
        </div>
      </template>

      <template #content>
        <form class="login-form" @submit.prevent="handleLogin">
          <Message v-if="errorMessage" severity="error" :closable="false">
            {{ errorMessage }}
          </Message>

          <div class="field">
            <label for="email">Email</label>
            <InputText
              id="email"
              v-model="email"
              type="email"
              placeholder="votre@email.com"
              autocomplete="username"
              :disabled="loading"
              fluid
            />
          </div>

          <div class="field">
            <label for="password">Mot de passe</label>
            <Password
              id="password"
              v-model="password"
              :feedback="false"
              autocomplete="current-password"
              :disabled="loading"
              fluid
            />
          </div>

          <Button
            type="submit"
            label="Se connecter"
            icon="pi pi-sign-in"
            :loading="loading"
            fluid
          />
        </form>
      </template>
    </Card>
  </AuthLayout>
</template>

<style scoped>
.login-card {
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  padding: 1.5rem 1.5rem 0;
}

.login-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--p-primary-color);
  margin: 0 0 0.25rem;
}

.login-subtitle {
  color: var(--p-text-muted-color);
  font-size: 0.9rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--p-text-color);
}
</style>
