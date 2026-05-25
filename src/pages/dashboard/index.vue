<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// Redirection role-aware
function getDashboardRoute(): string {
  if (auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR')) {
    return '/dashboard/directeur'
  }
  if (auth.hasRole('ROLE_FORMATEUR')) {
    return '/dashboard/formateur'
  }
  if (auth.hasRole('ROLE_RESPONSABLE_PED')) {
    return '/dashboard/responsable'
  }
  return '/dashboard/stagiaire'
}

router.replace(getDashboardRoute())
</script>

<template>
  <!-- Redirection transparente -->
</template>
