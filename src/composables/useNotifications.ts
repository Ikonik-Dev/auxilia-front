import { onUnmounted, ref } from 'vue'
import { apiNotificationsGetCollection, apiNotificationsIdPut } from '@/api'
import type { NotificationNotificationRead } from '@/api'

export function useNotifications() {
  const notifications = ref<NotificationNotificationRead[]>([])
  const unreadCount   = ref(0)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function fetchNotifications() {
    const { data } = await apiNotificationsGetCollection({ query: { page: 1 } })
    const list = data ?? []
    notifications.value = list.slice(0, 20)
    unreadCount.value   = list.filter((n) => !n.isRead).length
  }

  async function markAsRead(n: NotificationNotificationRead) {
    if (!n.id || n.isRead) return
    const { data } = await apiNotificationsIdPut({
      path: { id: String(n.id) },
      body: {
        title:             n.title,
        message:           n.message,
        type:              n.type,
        isRead:            true,
        readAt:            new Date().toISOString(),
        relatedEntityType: n.relatedEntityType ?? null,
        relatedEntityId:   n.relatedEntityId   ?? null,
        link:              n.link              ?? null,
      },
    })
    if (data) {
      const idx = notifications.value.findIndex((x) => x.id === n.id)
      if (idx !== -1) notifications.value[idx] = data
      unreadCount.value = notifications.value.filter((x) => !x.isRead).length
    }
  }

  async function markAllAsRead() {
    await Promise.allSettled(
      notifications.value.filter((n) => !n.isRead).map(markAsRead),
    )
  }

  function startPolling(intervalMs = 30_000) {
    fetchNotifications()
    pollTimer = setInterval(fetchNotifications, intervalMs)
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
  }

  onUnmounted(stopPolling)

  return { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, startPolling, stopPolling }
}
