<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import NotificationsPanel from '@/components/layout/NotificationsPanel.vue'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

interface NavItem {
  label: string
  icon: string
  to: string
  roles?: string[]
  primaryOnly?: boolean
}

// Ordre décroissant de priorité dans la hiérarchie des rôles
const ROLE_PRIORITY = ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED', 'ROLE_FORMATEUR', 'ROLE_USER']

function primaryRole(): string {
  for (const role of ROLE_PRIORITY) {
    if (auth.hasRole(role)) return role
  }
  return 'ROLE_USER'
}

const allNavItems: NavItem[] = [
  { label: 'Tableau de bord', icon: 'pi pi-home',           to: '/dashboard',     roles: [] },
  { label: 'Formations',      icon: 'pi pi-book',            to: '/formations',    roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
  { label: 'Utilisateurs',    icon: 'pi pi-users',           to: '/utilisateurs',  roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR'] },
  { label: 'Inscriptions',    icon: 'pi pi-user-plus',       to: '/inscriptions',  roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'] },
  { label: 'Évaluations',     icon: 'pi pi-check-circle',    to: '/evaluations',   roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
  { label: 'Assiduité',       icon: 'pi pi-calendar-clock',  to: '/assiduite',     roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
  { label: 'Statistiques',    icon: 'pi pi-chart-bar',       to: '/statistiques',  roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'] },
  { label: 'Mon Parcours',    icon: 'pi pi-map',             to: '/parcours',      roles: ['ROLE_USER'], primaryOnly: true },
  { label: 'Mes Documents',   icon: 'pi pi-file',            to: '/documents',     roles: ['ROLE_USER'], primaryOnly: true },
  { label: 'Messages',        icon: 'pi pi-envelope',        to: '/messages',      roles: [] },
]

const navItems = computed<NavItem[]>(() => {
  const primary = primaryRole()
  return allNavItems.filter((item) => {
    if (!item.roles || item.roles.length === 0) return true
    if (item.primaryOnly) return item.roles.includes(primary)
    return item.roles.some((role) => auth.hasRole(role))
  })
})

async function handleLogout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="app-layout">

    <!-- ── Sidebar ── -->
    <aside class="sidebar" aria-label="Navigation">
      <!-- Logo + cloche notifications -->
      <div class="sidebar-header">
        <div class="sidebar-logo-mark">
          <i class="pi pi-graduation-cap" />
        </div>
        <span class="sidebar-logo-text">Auxilium</span>
        <NotificationsPanel />
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav" role="navigation" aria-label="Navigation principale">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="nav-item"
          active-class="nav-item--active"
          :aria-current="route.path === item.to || route.path.startsWith(item.to + '/') ? 'page' : undefined"
        >
          <span class="nav-icon-wrap">
            <i :class="item.icon" />
          </span>
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </nav>

      <!-- Footer user area -->
      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">
            <i class="pi pi-user" />
          </div>
          <div class="user-info">
            <span class="user-name">{{ auth.userName }}</span>
            <span class="user-status">En ligne</span>
          </div>
        </div>

        <button class="logout-btn" @click="handleLogout">
          <i class="pi pi-sign-out" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>

    <!-- ── Main content ── -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
/* ── Layout shell ── */
.app-layout {
  display: flex;
  min-height: 100vh;
}

/* ── Sidebar ── */
.sidebar {
  width: 268px;
  min-width: 268px;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border-right: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 4px 0 28px rgba(139, 92, 246, 0.07);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0 1rem;
  position: relative;
  z-index: 10;
}

/* Logo */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0 1.25rem 1.5rem;
  border-bottom: 1px solid rgba(196, 181, 253, 0.25);
  margin-bottom: 0.75rem;
}

.sidebar-logo-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, #a78bfa 0%, #818cf8 100%);
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(139, 92, 246, 0.3);
  flex-shrink: 0;
}

.sidebar-logo-mark .pi {
  font-size: 1rem;
  color: #fff;
}

.sidebar-logo-text {
  font-size: 1.15rem;
  font-weight: 700;
  color: #4c1d95;
  letter-spacing: -0.02em;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  padding: 0.25rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.65rem 0.875rem;
  border-radius: 14px;
  color: #5b21b6;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: background 0.16s ease, transform 0.16s ease, color 0.16s ease;
}

.nav-item:hover {
  background: rgba(167, 139, 250, 0.13);
  transform: translateX(3px);
  color: #4c1d95;
}

.nav-item--active {
  background: linear-gradient(
    135deg,
    rgba(167, 139, 250, 0.22) 0%,
    rgba(129, 140, 248, 0.15) 100%
  );
  color: #6d28d9;
  font-weight: 600;
  box-shadow: 0 2px 12px rgba(139, 92, 246, 0.12);
}

.nav-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.55);
  flex-shrink: 0;
  font-size: 0.9rem;
  transition: background 0.16s;
}

.nav-item--active .nav-icon-wrap {
  background: rgba(167, 139, 250, 0.25);
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Footer */
.sidebar-footer {
  padding: 0.75rem 0.875rem 0;
  border-top: 1px solid rgba(196, 181, 253, 0.25);
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.875rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  flex-shrink: 0;
  font-size: 0.8rem;
  color: #4c1d95;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: #4c1d95;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-status {
  font-size: 0.7rem;
  color: #675c9c;
  display: flex;
  align-items: center;
  gap: 4px;
}

.user-status::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #86efac;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.6rem 0.875rem;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: #675c9c;
  font-size: 0.8125rem;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.16s, color 0.16s;
  text-align: left;
}

.logout-btn:hover {
  background: rgba(252, 165, 165, 0.18);
  color: #b91c1c;
}

/* ── Main content ── */
.main-content {
  flex: 1;
  padding: 2rem 2.25rem;
  overflow: auto;
  min-width: 0;
}

</style>
