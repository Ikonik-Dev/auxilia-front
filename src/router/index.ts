import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    roles?: string[]
  }
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/dashboard',
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/dashboard',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/pages/dashboard/index.vue'),
        },
        {
          path: 'directeur',
          name: 'dashboard-directeur',
          component: () => import('@/pages/dashboard/DirecteurDashboard.vue'),
          meta: { roles: ['ROLE_DIRECTEUR', 'ROLE_ADMIN'] },
        },
        {
          path: 'formateur',
          name: 'dashboard-formateur',
          component: () => import('@/pages/dashboard/FormateurDashboard.vue'),
          meta: { roles: ['ROLE_FORMATEUR'] },
        },
        {
          path: 'responsable',
          name: 'dashboard-responsable',
          component: () => import('@/pages/dashboard/ResponsablePedaDashboard.vue'),
          meta: { roles: ['ROLE_RESPONSABLE_PED', 'ROLE_DIRECTEUR', 'ROLE_ADMIN'] },
        },
        {
          path: 'stagiaire',
          name: 'dashboard-stagiaire',
          component: () => import('@/pages/dashboard/StagiaireDashboard.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/dashboard',
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth === false) {
    // Route publique — si déjà connecté, rediriger vers dashboard
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'dashboard' }
    }
    return true
  }

  // Route protégée — vérifier l'authentification
  if (!auth.isAuthenticated) {
    // Tentative de refresh automatique
    const refreshed = await auth.refresh()
    if (!refreshed) {
      return { name: 'login' }
    }
  }

  // Vérifier le rôle si requis
  if (to.meta.roles && to.meta.roles.length > 0) {
    const hasRequiredRole = to.meta.roles.some((role) => auth.hasRole(role))
    if (!hasRequiredRole) {
      return { name: 'dashboard' }
    }
  }

  return true
})
