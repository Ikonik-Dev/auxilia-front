<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import Button from 'primevue/button'
import Avatar from 'primevue/avatar'
import Divider from 'primevue/divider'

const auth = useAuthStore()
const router = useRouter()

interface NavItem {
  label: string
  icon: string
  to: string
  roles?: string[]
}

const allNavItems: NavItem[] = [
  // Admin / Directeur
  { label: 'Tableau de bord', icon: 'pi pi-home', to: '/dashboard', roles: [] },
  {
    label: 'Formations',
    icon: 'pi pi-book',
    to: '/formations',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'],
  },
  {
    label: 'Utilisateurs',
    icon: 'pi pi-users',
    to: '/utilisateurs',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR'],
  },
  {
    label: 'Inscriptions',
    icon: 'pi pi-user-plus',
    to: '/inscriptions',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'],
  },
  {
    label: 'Évaluations',
    icon: 'pi pi-check-circle',
    to: '/evaluations',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'],
  },
  {
    label: 'Assiduité',
    icon: 'pi pi-calendar-check',
    to: '/assiduite',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'],
  },
  {
    label: 'Statistiques',
    icon: 'pi pi-chart-bar',
    to: '/statistiques',
    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'],
  },
  // Stagiaire
  { label: 'Mon Parcours', icon: 'pi pi-map', to: '/parcours', roles: ['ROLE_USER'] },
  { label: 'Mes Documents', icon: 'pi pi-file', to: '/documents', roles: ['ROLE_USER'] },
  { label: 'Messages', icon: 'pi pi-envelope', to: '/messages', roles: [] },
]

const navItems = computed<NavItem[]>(() =>
  allNavItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true
    return item.roles.some((role) => auth.hasRole(role))
  }),
)

async function handleLogout() {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <span class="sidebar-logo">Auxilia LMS</span>
      </div>

      <nav class="sidebar-nav">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="sidebar-footer">
        <Divider />
        <div class="user-info">
          <Avatar icon="pi pi-user" shape="circle" />
          <span class="user-email">{{ auth.userEmail }}</span>
        </div>
        <Button
          label="Déconnexion"
          icon="pi pi-sign-out"
          severity="secondary"
          text
          size="small"
          @click="handleLogout"
        />
      </div>
    </aside>

    <!-- Main content -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  background: var(--p-surface-card);
  border-right: 1px solid var(--p-surface-border);
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.sidebar-header {
  padding: 0 1.25rem 1rem;
  border-bottom: 1px solid var(--p-surface-border);
  margin-bottom: 0.5rem;
}

.sidebar-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--p-primary-color);
}

.sidebar-nav {
  flex: 1;
  padding: 0.5rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--p-border-radius-md);
  color: var(--p-text-color);
  text-decoration: none;
  font-size: 0.9rem;
  transition: background 0.15s;
}

.nav-item:hover {
  background: var(--p-surface-hover);
}

.nav-item--active {
  background: var(--p-primary-100);
  color: var(--p-primary-color);
  font-weight: 600;
}

.sidebar-footer {
  padding: 0 0.75rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  margin-bottom: 0.25rem;
}

.user-email {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}

.main-content {
  flex: 1;
  background: var(--p-surface-ground);
  padding: 2rem;
  overflow: auto;
}
</style>
