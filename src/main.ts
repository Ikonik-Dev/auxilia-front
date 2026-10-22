// Doit être le premier import : configure le client SDK hey-api (baseUrl + credentials)
// avant que tout composable ne puisse déclencher un appel réseau.
import './api'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import { definePreset } from '@primeuix/themes'

const AuxiliaPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#faf5ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
      950: '#2e1065',
    },
  },
})
import ToastService from 'primevue/toastservice'
import 'primeicons/primeicons.css'
import { useAuthStore } from './stores/auth'
import { client } from './api/generated/client.gen'
import { installAuthInterceptor } from './api/authInterceptor'

import App from './App.vue'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: AuxiliaPreset,
    options: {
      darkModeSelector: '.dark',
    },
  },
})
app.use(ToastService)

const auth = useAuthStore()

// 401 sur un appel SDK : un refresh, un rejeu. Session perdue : retour à /login, une seule fois.
installAuthInterceptor(client, {
  doRefresh: auth.requestRefresh,
  onSessionLost: () => {
    if (auth.markSessionLost()) void router.replace({ name: 'login' })
  },
})

// Vérifier la session existante via cookie avant de monter l'app
await auth.fetchMe()

app.mount('#app')
