<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'

const router = useRouter()

onMounted(() => {
  document.title = 'Accès refusé — Auxilium'
})
</script>

<template>
  <div class="forbidden-page">
    <i class="pi pi-lock forbidden-icon" aria-hidden="true" />
    <h1>Accès refusé</h1>
    <p class="forbidden-message">
      Vous n'avez pas les permissions nécessaires pour accéder à cette page.
    </p>
    <Button
      label="Retour au tableau de bord"
      icon="pi pi-arrow-left"
      @click="router.push({ name: 'dashboard' })"
    />
  </div>
</template>

<style scoped>
.forbidden-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: 1.25rem;
  text-align: center;
}

.forbidden-icon {
  font-size: 3rem;
  color: var(--p-text-muted-color);
}

.forbidden-page h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
}

.forbidden-message {
  margin: 0;
  color: var(--p-text-muted-color);
  max-width: 420px;
  line-height: 1.5;
}
</style>
