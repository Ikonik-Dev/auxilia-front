<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tag from 'primevue/tag'
import Skeleton from 'primevue/skeleton'
import InputText from 'primevue/inputtext'
import type { MessageMessageRead } from '@/api'
import { useMessages } from '@/composables/useMessages'

const { threads, loading, error, fetchMessages, repliesOf } = useMessages()

onMounted(() => {
  document.title = 'Messages — Auxilium'
  fetchMessages()
})

// --- Sélection de thread ---
const selectedThread = ref<MessageMessageRead | null>(null)

const replies = computed(() =>
  selectedThread.value ? repliesOf(selectedThread.value.id) : [],
)

function selectThread(thread: MessageMessageRead) {
  selectedThread.value = thread
}

// --- Filtre ---
const search = ref('')
const filteredThreads = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return threads.value
  return threads.value.filter((t) => t.subject.toLowerCase().includes(q))
})

// --- Helpers ---
function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
}

function extractId(iri: string | null | undefined): string {
  if (!iri) return '?'
  return iri.split('/').pop() ?? iri
}
</script>

<template>
  <div class="messages-page" :aria-busy="loading ? 'true' : undefined">
    <h1 class="sr-only">Messages</h1>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="error-message">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />
      {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="skeleton-list" aria-label="Chargement des messages en cours">
      <Skeleton v-for="i in 5" :key="i" height="4rem" class="skeleton-thread" />
    </div>

    <!-- Layout split -->
    <div v-else class="messages-layout">
      <!-- Panneau gauche : liste des threads -->
      <aside class="threads-panel" aria-label="Liste des conversations">
        <div class="threads-header">
          <h2 class="threads-title">Conversations</h2>
          <InputText
            v-model="search"
            placeholder="Rechercher…"
            aria-label="Rechercher une conversation"
            class="threads-search"
          />
        </div>

        <div v-if="filteredThreads.length === 0" class="threads-empty">
          Aucune conversation.
        </div>

        <ul class="threads-list" role="listbox" aria-label="Conversations">
          <li
            v-for="thread in filteredThreads"
            :key="thread.id"
            role="option"
            :aria-selected="selectedThread?.id === thread.id"
            class="thread-item"
            :class="{ 'thread-item--active': selectedThread?.id === thread.id, 'thread-item--unread': !thread.isRead }"
            @click="selectThread(thread)"
            @keydown.enter="selectThread(thread)"
            @keydown.space.prevent="selectThread(thread)"
            tabindex="0"
          >
            <div class="thread-subject">{{ thread.subject }}</div>
            <div class="thread-meta">
              <span class="thread-sender">De #{{ extractId(thread.sender) }}</span>
              <span class="thread-date">{{ formatDate(thread.sentAt) }}</span>
            </div>
            <Tag v-if="!thread.isRead" value="Nouveau" severity="info" class="unread-tag" />
          </li>
        </ul>
      </aside>

      <!-- Panneau droit : détail du thread -->
      <section
        class="thread-detail"
        aria-label="Détail de la conversation"
        aria-live="polite"
      >
        <div v-if="!selectedThread" class="thread-placeholder">
          <i class="pi pi-envelope placeholder-icon" aria-hidden="true" />
          <p>Sélectionnez une conversation pour lire les messages.</p>
        </div>

        <template v-else>
          <!-- Message racine -->
          <article class="message-card message-card--root" aria-label="Message principal">
            <header class="message-header">
              <h2 class="message-subject">{{ selectedThread.subject }}</h2>
              <div class="message-meta">
                <span>De #{{ extractId(selectedThread.sender) }}</span>
                <span>→ #{{ extractId(selectedThread.recipient) }}</span>
                <time :datetime="selectedThread.sentAt">{{ formatDate(selectedThread.sentAt) }}</time>
              </div>
            </header>
            <p class="message-content">{{ selectedThread.content }}</p>
          </article>

          <!-- Réponses -->
          <div v-if="replies.length > 0" class="replies-section" aria-label="Réponses">
            <h3 class="replies-title">
              {{ replies.length }} réponse{{ replies.length > 1 ? 's' : '' }}
            </h3>
            <article
              v-for="reply in replies"
              :key="reply.id"
              class="message-card message-card--reply"
              aria-label="Réponse"
            >
              <header class="message-header">
                <div class="message-meta">
                  <span>De #{{ extractId(reply.sender) }}</span>
                  <time :datetime="reply.sentAt">{{ formatDate(reply.sentAt) }}</time>
                </div>
              </header>
              <p class="message-content">{{ reply.content }}</p>
            </article>
          </div>

          <p v-else class="no-replies">Aucune réponse pour l'instant.</p>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.messages-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  border-radius: var(--p-border-radius-md);
  background: var(--p-red-100);
  color: var(--p-red-700);
  font-size: 0.9rem;
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.skeleton-thread {
  border-radius: var(--p-border-radius-md);
}

.messages-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 0;
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-lg);
  overflow: hidden;
  min-height: 500px;
}

/* --- Panneau gauche --- */
.threads-panel {
  border-right: 1px solid var(--p-surface-border);
  background: var(--p-surface-card);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.threads-header {
  padding: 1rem;
  border-bottom: 1px solid var(--p-surface-border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.threads-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.threads-search {
  width: 100%;
}

.threads-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--p-text-muted-color);
  font-size: 0.85rem;
}

.threads-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0;
  overflow-y: auto;
  flex: 1;
}

.thread-item {
  padding: 0.75rem 1rem;
  cursor: pointer;
  border-left: 3px solid transparent;
  position: relative;
  transition: background 0.15s;
}

.thread-item:hover,
.thread-item:focus-visible {
  background: var(--p-surface-hover);
  outline: none;
}

.thread-item:focus-visible {
  outline: 2px solid var(--p-primary-color);
  outline-offset: -2px;
}

.thread-item--active {
  background: var(--p-primary-50);
  border-left-color: var(--p-primary-color);
}

.thread-item--unread .thread-subject {
  font-weight: 600;
}

.thread-subject {
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thread-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--p-text-muted-color);
}

.unread-tag {
  margin-top: 0.25rem;
  font-size: 0.7rem;
}

/* --- Panneau droit --- */
.thread-detail {
  background: var(--p-surface-ground);
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.thread-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--p-text-muted-color);
  text-align: center;
  gap: 1rem;
}

.placeholder-icon {
  font-size: 2.5rem;
}

.message-card {
  background: var(--p-surface-card);
  border: 1px solid var(--p-surface-border);
  border-radius: var(--p-border-radius-lg);
  padding: 1.25rem;
}

.message-card--reply {
  margin-left: 1.5rem;
  border-left: 3px solid var(--p-surface-border);
}

.message-header {
  margin-bottom: 0.75rem;
}

.message-subject {
  margin: 0 0 0.4rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.message-meta {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
  flex-wrap: wrap;
}

.message-content {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.6;
  white-space: pre-wrap;
}

.replies-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.replies-title {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--p-text-muted-color);
  text-transform: uppercase;
}

.no-replies {
  margin: 0;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  font-style: italic;
}
</style>
