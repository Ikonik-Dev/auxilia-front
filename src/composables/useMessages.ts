import { computed, ref } from 'vue'
import { apiMessagesGetCollection, apiMessagesPost, apiUsersGetCollection } from '@/api'
import type { MessageMessageRead } from '@/api'

export function useMessages() {
  const messages = ref<MessageMessageRead[]>([])
  const userMap  = ref(new Map<string, string>())
  const loading  = ref(false)
  const error    = ref<string | null>(null)

  // Threads = messages sans parent
  const threads = computed(() =>
    messages.value.filter((m) => m.parent === null || m.parent === undefined),
  )

  const unreadCount = computed(() => messages.value.filter((m) => !m.isRead && !m.parent).length)

  function repliesOf(threadId: number | undefined): MessageMessageRead[] {
    if (!threadId) return []
    return messages.value.filter((m) => {
      if (!m.parent) return false
      const p = m.parent as unknown
      if (typeof p === 'object' && p !== null && 'id' in p) return (p as { id: number }).id === threadId
      if (typeof p === 'string') return p.endsWith(`/${threadId}`)
      return false
    })
  }

  function getUserName(iri: string | null | undefined): string {
    if (!iri) return '—'
    return userMap.value.get(iri) ?? `#${iri.split('/').pop()}`
  }

  async function fetchMessages(page = 1) {
    loading.value = true
    error.value   = null
    try {
      const [msgRes, usrRes] = await Promise.all([
        apiMessagesGetCollection({ query: { page } }),
        apiUsersGetCollection(),
      ])
      if (msgRes.error) error.value = 'Impossible de charger les messages.'
      else messages.value = msgRes.data ?? []

      const map = new Map<string, string>()
      for (const u of usrRes.data ?? []) {
        if (u.id) map.set(`/api/users/${u.id}`, `${u.firstName} ${u.lastName}`)
      }
      userMap.value = map
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
  }): Promise<MessageMessageRead> {
    const body = {
      subject:   payload.subject,
      content:   payload.content,
      isRead:    false,
      recipient: payload.recipientIri,
    } as Record<string, unknown>

    if (payload.parentIri) body.parent = payload.parentIri

    const { data, error: apiError } = await apiMessagesPost({ body: body as never })
    if (apiError || !data) throw new Error('Impossible d\'envoyer le message.')
    messages.value.push(data)
    return data
  }

  return { messages, threads, unreadCount, loading, error, fetchMessages, repliesOf, getUserName, sendMessage }
}
