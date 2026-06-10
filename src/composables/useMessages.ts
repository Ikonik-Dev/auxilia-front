import { computed, ref } from 'vue'
import { apiMessagesGetCollection, apiMessagesPost } from '@/api'
import type { MessageMessageReadUserSummary } from '@/api'

export function useMessages() {
  const messages = ref<MessageMessageReadUserSummary[]>([])
  const loading  = ref(false)
  const error    = ref<string | null>(null)

  // Threads = messages sans parent
  const threads = computed(() =>
    messages.value.filter((m) => m.parent === null || m.parent === undefined),
  )

  const unreadCount = computed(() => messages.value.filter((m) => !m.isRead && !m.parent).length)

  function repliesOf(threadId: number | undefined): MessageMessageReadUserSummary[] {
    if (!threadId) return []
    return messages.value.filter((m) => {
      if (!m.parent) return false
      const p = m.parent as unknown
      if (typeof p === 'object' && p !== null && 'id' in p) return (p as { id: number }).id === threadId
      if (typeof p === 'string') return p.endsWith(`/${threadId}`)
      return false
    })
  }

  function getUserName(user: { firstName?: string; lastName?: string } | string | null | undefined): string {
    if (!user) return '—'
    if (typeof user === 'object') return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || '—'
    return `#${user.split('/').pop()}`
  }

  async function fetchMessages(page = 1) {
    loading.value = true
    error.value   = null
    try {
      const res = await apiMessagesGetCollection({ query: { page } })
      if (res.error) error.value = 'Impossible de charger les messages.'
      else messages.value = res.data ?? []
    } catch {
      error.value = 'Impossible de charger les messages.'
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(payload: {
    subject: string
    content: string
    recipientIri: string
    parentIri?: string
  }): Promise<MessageMessageReadUserSummary> {
    const body = {
      subject:   payload.subject,
      content:   payload.content,
      isRead:    false,
      recipient: payload.recipientIri,
    } as Record<string, unknown>

    if (payload.parentIri) body.parent = payload.parentIri

    const { data, error: apiError } = await apiMessagesPost({ body: body as never })
    if (apiError || !data) throw new Error('Impossible d\'envoyer le message.')
    messages.value.push(data as MessageMessageReadUserSummary)
    return data as MessageMessageReadUserSummary
  }

  return { messages, threads, unreadCount, loading, error, fetchMessages, repliesOf, getUserName, sendMessage }
}
