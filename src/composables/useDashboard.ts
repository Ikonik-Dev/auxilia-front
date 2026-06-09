import { ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

// The generated SDK types PHP array fields as (string|null)[] — use unknown here
// and rely on the per-component interfaces + "as T" cast (consistent with the rest of the codebase).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FetchFn<_T> = () => Promise<{ data?: any; error?: unknown; response?: Response }>

export function useDashboard<T>(fetchFn: FetchFn<T>) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isRateLimited = ref(false)
  const rateLimitSeconds = ref(0)

  let rateLimitTimer: ReturnType<typeof setTimeout> | null = null
  const router = useRouter()

  async function load() {
    if (isRateLimited.value) return

    loading.value = true
    error.value = null

    const result = await fetchFn()

    if (result.error !== undefined) {
      const status = result.response?.status

      if (status === 401) {
        router.push('/login')
      } else if (status === 403) {
        error.value = 'Accès non autorisé pour votre rôle.'
      } else if (status === 429) {
        const retryAfterHeader = result.response?.headers?.get?.('Retry-After')
        const secs = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60
        rateLimitSeconds.value = isNaN(secs) ? 60 : secs
        isRateLimited.value = true
        error.value = `Trop de requêtes. Réessayez dans ${rateLimitSeconds.value} secondes.`
        rateLimitTimer = setTimeout(() => {
          isRateLimited.value = false
          rateLimitSeconds.value = 0
          error.value = null
        }, rateLimitSeconds.value * 1000)
      } else {
        error.value = 'Impossible de charger le tableau de bord.'
      }
    } else {
      data.value = result.data as T
    }

    loading.value = false
  }

  function refetch() {
    if (!isRateLimited.value) {
      load()
    }
  }

  onUnmounted(() => {
    if (rateLimitTimer !== null) clearTimeout(rateLimitTimer)
  })

  return { data, loading, error, isRateLimited, rateLimitSeconds, load, refetch }
}
