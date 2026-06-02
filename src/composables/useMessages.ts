import { computed, ref } from 'vue'
import { apiMessagesGetCollection } from '@/api'
import type { MessageMessageRead } from '@/api'

export function useMessages() {
  const messages = ref<MessageMessageRead[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Threads = messages sans parent (racine de conversation)
  const threads = computed(() =>
    messages.value.filter((m) => m.parent === null || m.parent === undefined),
  )

  // Replies d'un thread donné
  function repliesOf(threadId: number | undefined): MessageMessageRead[] {
    if (!threadId) return []
    return messages.value.filter((m) => {
      if (!m.parent) return false
      // parent peut être un objet MessageMessageRead ou une IRI string selon la sérialisation
      const p = m.parent as unknown
      if (typeof p === 'object' && p !== null && 'id' in p) {
        return (p as MessageMessageRead).id === threadId
      }
      if (typeof p === 'string') {
        return p.endsWith(`/${threadId}`)
      }
      return false
    })
  }

  async function fetchMessages(page = 1) {
    loading.value = true
    error.value = null
    try {
      const { data, error: apiError } = await apiMessagesGetCollection({ query: { page } })
      if (apiError) {
        error.value = 'Impossible de charger les messages.'
      } else {
        messages.value = data ?? []
      }
    } catch {
      error.value = 'Impossible de charger les messages.'
    } finally {
      loading.value = false
    }
  }

  return { messages, threads, loading, error, fetchMessages, repliesOf }
}
