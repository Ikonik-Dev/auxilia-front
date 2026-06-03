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
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/LoginPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      // AppLayout est le parent unique de toutes les pages authentifiées.
      // Les routes métier (/formations, /messages, etc.) sont des enfants directs
      // pour que la sidebar reste visible sans dupliquer le layout.
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },

        // Tableau de bord — la redirection role-aware est dans le router
        // pour éviter une double navigation (composant qui appelle router.replace)
        {
          path: 'dashboard',
          children: [
            {
              path: '',
              name: 'dashboard',
              redirect: () => {
                const auth = useAuthStore()
                if (auth.hasRole('ROLE_ADMIN') || auth.hasRole('ROLE_DIRECTEUR')) return '/dashboard/directeur'
                if (auth.hasRole('ROLE_FORMATEUR')) return '/dashboard/formateur'
                if (auth.hasRole('ROLE_RESPONSABLE_PED')) return '/dashboard/responsable'
                return '/dashboard/stagiaire'
              },
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
              component: () =>
                import('@/pages/dashboard/ResponsablePedaDashboard.vue'),
              meta: { roles: ['ROLE_RESPONSABLE_PED', 'ROLE_DIRECTEUR', 'ROLE_ADMIN'] },
            },
            {
              path: 'stagiaire',
              name: 'dashboard-stagiaire',
              component: () => import('@/pages/dashboard/StagiaireDashboard.vue'),
            },
          ],
        },

        // Pages métier
        {
          path: 'formations',
          name: 'formations',
          component: () => import('@/pages/formations/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
        },
        {
          path: 'formations/:id',
          name: 'formation-detail',
          component: () => import('@/pages/formations/FormationDetailPage.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
        },
        {
          path: 'utilisateurs',
          name: 'utilisateurs',
          component: () => import('@/pages/utilisateurs/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR'] },
        },
        {
          path: 'inscriptions',
          name: 'inscriptions',
          component: () => import('@/pages/inscriptions/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'] },
        },
        {
          path: 'parcours',
          name: 'parcours',
          component: () => import('@/pages/parcours/index.vue'),
          meta: { roles: ['ROLE_USER'] },
        },
        {
          path: 'documents',
          name: 'documents',
          component: () => import('@/pages/documents/index.vue'),
          meta: { roles: ['ROLE_USER'] },
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('@/pages/messages/index.vue'),
        },
        {
          path: 'evaluations',
          name: 'evaluations',
          component: () => import('@/pages/evaluations/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
        },
        {
          path: 'assiduite',
          name: 'assiduite',
          component: () => import('@/pages/assiduite/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_FORMATEUR'] },
        },
        {
          path: 'statistiques',
          name: 'statistiques',
          component: () => import('@/pages/statistiques/index.vue'),
          meta: { roles: ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_RESPONSABLE_PED'] },
        },

        // Erreurs
        {
          path: 'forbidden',
          name: 'forbidden',
          component: () => import('@/pages/errors/ForbiddenPage.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
})

// Si un composant lazy échoue à charger (réseau, bug JS), on force un rechargement
// pour éviter que le router reste bloqué "pending" et bloque toutes les navigations suivantes.
router.onError((error, to) => {
  const isChunkError =
    error.message?.includes('Failed to fetch dynamically imported module') ||
    error.message?.includes('Importing a module script failed') ||
    error.name === 'ChunkLoadError'
  if (isChunkError) {
    window.location.href = to.fullPath
  }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth === false) {
    if (auth.isAuthenticated && to.name === 'login') {
      return { name: 'dashboard' }
    }
    return true
  }

  if (!auth.isAuthenticated) {
    const refreshed = await auth.refresh()
    if (!refreshed) {
      return { name: 'login' }
    }
  }

  if (to.meta.roles && to.meta.roles.length > 0) {
    const hasRequiredRole = to.meta.roles.some((role) => auth.hasRole(role))
    if (!hasRequiredRole) {
      return { name: 'forbidden' }
    }
  }

  return true
})
