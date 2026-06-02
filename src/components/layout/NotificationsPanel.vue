<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotifications } from '@/composables/useNotifications'
import type { NotificationNotificationRead } from '@/api'
import Popover from 'primevue/popover'
import Button from 'primevue/button'

const router = useRouter()
const { notifications, unreadCount, markAsRead, markAllAsRead, startPolling } = useNotifications()

const popoverRef = ref<InstanceType<typeof Popover> | null>(null)
const bellRef    = ref<HTMLButtonElement | null>(null)

onMounted(() => startPolling(30_000))

function togglePanel(event: MouseEvent) {
  popoverRef.value?.toggle(event)
}

// Notification type → icon + color
const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  enrollment_validated: { icon: 'pi-user-plus',    color: '#22c55e' },
  message_received:     { icon: 'pi-envelope',      color: '#8b5cf6' },
  evaluation_graded:    { icon: 'pi-check-circle',  color: '#22c55e' },
  certificate_issued:   { icon: 'pi-verified',      color: '#f59e0b' },
  enrollment_created:   { icon: 'pi-user-plus',     color: '#6366f1' },
  attendance_recorded:  { icon: 'pi-calendar-check',color: '#67e8f9' },
}

function typeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: 'pi-bell', color: '#7c6fa0' }
}

// Relative time
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)  return 'À l\'instant'
  if (m < 60) return `Il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `Il y a ${h} h`
  return `Il y a ${Math.floor(h / 24)} j`
}

// Build route link from notification
const ENTITY_ROUTES: Record<string, string> = {
  formation:  '/formations',
  enrollment: '/inscriptions',
  evaluation: '/evaluations',
  message:    '/messages',
  session:    '/inscriptions',
}

function getRoute(n: NotificationNotificationRead): string | null {
  if (n.link) return n.link
  if (n.relatedEntityType && n.relatedEntityId) {
    const base = ENTITY_ROUTES[n.relatedEntityType]
    if (base) return `${base}/${n.relatedEntityId}`
  }
  return null
}

async function handleClick(n: NotificationNotificationRead) {
  await markAsRead(n)
  const route = getRoute(n)
  if (route) {
    popoverRef.value?.hide()
    router.push(route)
  }
}
</script>

<template>
  <!-- Bell button -->
  <button
    ref="bellRef"
    class="bell-btn"
    :aria-label="`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`"
    @click="togglePanel"
  >
    <i class="pi pi-bell bell-icon" />
    <span
      v-if="unreadCount > 0"
      class="bell-badge"
      aria-live="polite"
    >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
  </button>

  <!-- Overlay panel -->
  <Popover ref="popoverRef" class="notif-popover">
    <div class="notif-panel">
      <!-- Header -->
      <div class="notif-header">
        <span class="notif-title">Notifications</span>
        <Button
          v-if="unreadCount > 0"
          label="Tout lire"
          text
          size="small"
          class="mark-all-btn"
          @click="markAllAsRead"
        />
      </div>

      <!-- Liste -->
      <div class="notif-list" role="list" aria-label="Notifications">
        <div v-if="notifications.length === 0" class="notif-empty">
          <i class="pi pi-bell-slash" />
          <p>Aucune notification</p>
        </div>

        <div
          v-for="n in notifications"
          :key="n.id"
          role="listitem"
          class="notif-item"
          :class="{ 'notif-item--unread': !n.isRead, 'notif-item--clickable': !!getRoute(n) }"
          :tabindex="getRoute(n) ? 0 : undefined"
          @click="handleClick(n)"
          @keydown.enter="handleClick(n)"
        >
          <!-- Icône type -->
          <div class="notif-icon-wrap" :style="{ color: typeConfig(n.type).color, background: typeConfig(n.type).color + '20' }">
            <i class="pi" :class="typeConfig(n.type).icon" />
          </div>

          <!-- Contenu -->
          <div class="notif-content">
            <p class="notif-msg-title">{{ n.title }}</p>
            <p class="notif-msg-body">{{ n.message }}</p>
            <span class="notif-time">{{ relativeTime(n.createdAt) }}</span>
          </div>

          <!-- Dot non lu -->
          <span v-if="!n.isRead" class="notif-dot" aria-hidden="true" />
        </div>
      </div>
    </div>
  </Popover>
</template>

<style scoped>
/* ── Bell button ── */
.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  border: none;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.15s;
}

.bell-btn:hover {
  background: rgba(167, 139, 250, 0.2);
  transform: scale(1.05);
}

.bell-icon {
  font-size: 1rem;
  color: #5b21b6;
}

.bell-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: linear-gradient(135deg, #ef4444, #f97316);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* ── Popover panel ── */
:deep(.notif-popover) {
  width: 340px !important;
  max-width: 92vw !important;
  padding: 0 !important;
  background: rgba(255, 255, 255, 0.82) !important;
  backdrop-filter: blur(24px) saturate(200%) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  border-radius: 18px !important;
  box-shadow: 0 12px 40px rgba(139, 92, 246, 0.15) !important;
  overflow: hidden !important;
}

:deep(.notif-popover .p-popover-content) {
  padding: 0 !important;
}

.notif-panel { display: flex; flex-direction: column; }

/* Header */
.notif-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2);
}

.notif-title {
  font-size: 0.9rem;
  font-weight: 700;
  color: #4c1d95;
}

.mark-all-btn {
  font-size: 0.75rem !important;
  padding: 0.25rem 0.5rem !important;
}

/* List */
.notif-list {
  max-height: 380px;
  overflow-y: auto;
}

.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: #9ca3af;
  font-size: 0.875rem;
}

.notif-empty .pi { font-size: 2rem; opacity: 0.3; }
.notif-empty p   { margin: 0; }

/* Item */
.notif-item {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid rgba(196, 181, 253, 0.1);
  transition: background 0.15s;
  position: relative;
}

.notif-item:last-child { border-bottom: none; }
.notif-item--unread    { background: rgba(237, 233, 254, 0.3); }
.notif-item--clickable { cursor: pointer; }
.notif-item--clickable:hover { background: rgba(237, 233, 254, 0.5); }
.notif-item:focus-visible { outline: 2px solid #8b5cf6; outline-offset: -2px; }

/* Icon */
.notif-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  flex-shrink: 0;
}

/* Content */
.notif-content { flex: 1; min-width: 0; }

.notif-msg-title {
  margin: 0 0 2px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e1b4b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notif-msg-body {
  margin: 0 0 4px;
  font-size: 0.75rem;
  color: #6b7280;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.notif-time {
  font-size: 0.68rem;
  color: #9ca3af;
}

/* Unread dot */
.notif-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8b5cf6;
  flex-shrink: 0;
  margin-top: 4px;
}
</style>
