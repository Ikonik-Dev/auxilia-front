<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMessages } from '@/composables/useMessages'
import { apiUsersGetCollection } from '@/api'
import type { MessageMessageRead } from '@/api'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const { threads, unreadCount, loading, error, fetchMessages, repliesOf, getUserName, sendMessage } = useMessages()

onMounted(() => {
  document.title = 'Messages — Auxilium'
  fetchMessages()
})

// ── Sélection thread ──
const selectedThread = ref<MessageMessageRead | null>(null)
const replies = computed(() => selectedThread.value ? repliesOf(selectedThread.value.id) : [])

function selectThread(t: MessageMessageRead) {
  selectedThread.value = t
  replyContent.value = ''
  showReply.value = false
}

// ── Filtre ──
const search = ref('')
const filteredThreads = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return threads.value
  return threads.value.filter((t) => t.subject.toLowerCase().includes(q) || t.content.toLowerCase().includes(q))
})

// ── Helpers ──
function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('fr-FR', { dateStyle: 'short' })
}

function formatDateFull(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

function getInitials(iri: string | null | undefined): string {
  const name = getUserName(iri)
  if (name.startsWith('#')) return '?'
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2)
}

// ── Réponse rapide ──
const showReply   = ref(false)
const replyContent = ref('')
const sendingReply = ref(false)

async function handleReply() {
  if (!replyContent.value.trim() || !selectedThread.value) return
  const senderIri    = selectedThread.value.sender
  const recipientIri = senderIri ?? selectedThread.value.sender
  if (!recipientIri) return

  sendingReply.value = true
  try {
    await sendMessage({
      subject:      `Re: ${selectedThread.value.subject}`,
      content:      replyContent.value.trim(),
      recipientIri: String(recipientIri),
      parentIri:    `/api/messages/${selectedThread.value.id}`,
    })
    replyContent.value = ''
    showReply.value    = false
    toast.add({ severity: 'success', summary: 'Réponse envoyée', life: 2500 })
  } catch {
    toast.add({ severity: 'error', summary: 'Envoi impossible', life: 3000 })
  } finally {
    sendingReply.value = false
  }
}

// ── Nouveau message Dialog ──
const showNewMsg    = ref(false)
const newSubject    = ref('')
const newContent    = ref('')
const newRecipient  = ref<string | null>(null)
const sendingNew    = ref(false)
const newMsgError   = ref<string | null>(null)
const userOptions   = ref<{ label: string; value: string }[]>([])

async function openNewMsg() {
  newSubject.value   = ''
  newContent.value   = ''
  newRecipient.value = null
  newMsgError.value  = null
  showNewMsg.value   = true
  if (userOptions.value.length === 0) {
    const { data } = await apiUsersGetCollection()
    userOptions.value = (data ?? [])
      .filter((u) => u.isActive)
      .map((u) => ({ label: `${u.firstName} ${u.lastName} — ${u.email}`, value: `/api/users/${u.id}` }))
  }
}

async function handleSendNew() {
  newMsgError.value = null
  if (!newSubject.value.trim())  { newMsgError.value = 'Le sujet est obligatoire.'; return }
  if (!newContent.value.trim())  { newMsgError.value = 'Le message est obligatoire.'; return }
  if (!newRecipient.value)       { newMsgError.value = 'Sélectionnez un destinataire.'; return }

  sendingNew.value = true
  try {
    await sendMessage({ subject: newSubject.value.trim(), content: newContent.value.trim(), recipientIri: newRecipient.value })
    showNewMsg.value = false
    toast.add({ severity: 'success', summary: 'Message envoyé', life: 2500 })
  } catch {
    newMsgError.value = 'Impossible d\'envoyer le message.'
  } finally {
    sendingNew.value = false
  }
}
</script>

<template>
  <div class="messages-page">
    <Toast />

    <div class="page-header">
      <h1>
        Messages
        <span v-if="unreadCount > 0" class="unread-badge">{{ unreadCount }}</span>
      </h1>
      <Button label="Nouveau message" icon="pi pi-send" @click="openNewMsg" />
    </div>

    <!-- Erreur -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton">
      <Skeleton v-for="i in 5" :key="i" height="4.5rem" border-radius="12px" />
    </div>

    <!-- Layout split -->
    <div v-else class="messages-layout">

      <!-- ── Panneau gauche : threads ── -->
      <aside class="threads-panel" aria-label="Liste des conversations">
        <div class="threads-header">
          <InputText
            v-model="search"
            placeholder="Rechercher…"
            aria-label="Rechercher une conversation"
            class="threads-search"
          />
        </div>

        <div v-if="filteredThreads.length === 0" class="threads-empty">
          <i class="pi pi-envelope" />
          <p>Aucune conversation.</p>
        </div>

        <ul v-else class="threads-list" role="listbox" aria-label="Conversations">
          <li
            v-for="t in filteredThreads"
            :key="t.id"
            role="option"
            :aria-selected="selectedThread?.id === t.id"
            class="thread-item"
            :class="{
              'thread-item--active':  selectedThread?.id === t.id,
              'thread-item--unread':  !t.isRead,
            }"
            tabindex="0"
            @click="selectThread(t)"
            @keydown.enter="selectThread(t)"
            @keydown.space.prevent="selectThread(t)"
          >
            <!-- Avatar expéditeur -->
            <div class="thread-avatar" :class="{ 'thread-avatar--unread': !t.isRead }">
              {{ getInitials(t.sender) }}
            </div>

            <div class="thread-body">
              <div class="thread-top">
                <span class="thread-subject" :class="{ 'thread-subject--bold': !t.isRead }">
                  {{ t.subject }}
                </span>
                <span class="thread-date">{{ formatDate(t.sentAt) }}</span>
              </div>
              <div class="thread-preview">{{ t.content.slice(0, 80) }}{{ t.content.length > 80 ? '…' : '' }}</div>
              <div class="thread-sender">{{ getUserName(t.sender) }}</div>
            </div>

            <span v-if="!t.isRead" class="unread-dot" aria-label="Non lu" />
          </li>
        </ul>
      </aside>

      <!-- ── Panneau droit : détail ── -->
      <section class="thread-detail" aria-label="Détail de la conversation" aria-live="polite">
        <div v-if="!selectedThread" class="thread-placeholder">
          <i class="pi pi-envelope placeholder-icon" aria-hidden="true" />
          <p>Sélectionnez une conversation pour lire les messages.</p>
        </div>

        <template v-else>
          <!-- Message racine -->
          <article class="msg-card msg-card--root">
            <header class="msg-header">
              <h2 class="msg-subject">{{ selectedThread.subject }}</h2>
              <div class="msg-meta">
                <div class="msg-meta-row">
                  <div class="msg-avatar">{{ getInitials(selectedThread.sender) }}</div>
                  <div>
                    <span class="msg-from">{{ getUserName(selectedThread.sender) }}</span>
                    <span class="msg-to">→ {{ getUserName(selectedThread.recipient) }}</span>
                  </div>
                </div>
                <time class="msg-date">{{ formatDateFull(selectedThread.sentAt) }}</time>
              </div>
            </header>
            <p class="msg-content">{{ selectedThread.content }}</p>

            <div class="msg-footer">
              <Button
                label="Répondre"
                icon="pi pi-reply"
                text
                size="small"
                @click="showReply = !showReply"
              />
            </div>
          </article>

          <!-- Réponses -->
          <div v-if="replies.length > 0" class="replies-section">
            <div class="replies-label">{{ replies.length }} réponse(s)</div>
            <article
              v-for="reply in replies"
              :key="reply.id"
              class="msg-card msg-card--reply"
            >
              <header class="msg-header">
                <div class="msg-meta">
                  <div class="msg-meta-row">
                    <div class="msg-avatar msg-avatar--sm">{{ getInitials(reply.sender) }}</div>
                    <span class="msg-from">{{ getUserName(reply.sender) }}</span>
                  </div>
                  <time class="msg-date">{{ formatDateFull(reply.sentAt) }}</time>
                </div>
              </header>
              <p class="msg-content">{{ reply.content }}</p>
            </article>
          </div>

          <!-- Formulaire réponse -->
          <div v-if="showReply" class="reply-form">
            <div class="reply-form-header">
              <span class="reply-form-label">Répondre à {{ getUserName(selectedThread.sender) }}</span>
            </div>
            <Textarea
              v-model="replyContent"
              rows="3"
              placeholder="Votre réponse…"
              style="width: 100%"
              autofocus
            />
            <div class="reply-actions">
              <Button label="Annuler" text severity="secondary" size="small" @click="showReply = false; replyContent = ''" />
              <Button
                label="Envoyer"
                icon="pi pi-send"
                size="small"
                :loading="sendingReply"
                :disabled="!replyContent.trim()"
                @click="handleReply"
              />
            </div>
          </div>

          <p v-else-if="replies.length === 0 && !showReply" class="no-replies">
            Aucune réponse pour l'instant.
          </p>
        </template>
      </section>
    </div>

    <!-- Dialog nouveau message -->
    <Dialog
      v-model:visible="showNewMsg"
      modal
      header="Nouveau message"
      :style="{ width: '560px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <div class="new-msg-form">
        <div v-if="newMsgError" class="form-banner-error" role="alert">
          <i class="pi pi-exclamation-circle" /> {{ newMsgError }}
        </div>

        <div class="field">
          <label for="nm-to">Destinataire <span class="req">*</span></label>
          <Select
            id="nm-to"
            v-model="newRecipient"
            :options="userOptions"
            option-label="label"
            option-value="value"
            placeholder="Sélectionner un utilisateur"
            fluid
            filter
          />
        </div>

        <div class="field">
          <label for="nm-subject">Sujet <span class="req">*</span></label>
          <InputText id="nm-subject" v-model="newSubject" placeholder="Objet du message" fluid />
        </div>

        <div class="field">
          <label for="nm-content">Message <span class="req">*</span></label>
          <Textarea id="nm-content" v-model="newContent" rows="5" placeholder="Votre message…" style="width:100%" />
        </div>

        <div class="form-actions">
          <Button label="Annuler" severity="secondary" text :disabled="sendingNew" @click="showNewMsg = false" />
          <Button label="Envoyer" icon="pi pi-send" :loading="sendingNew" @click="handleSendNew" />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.messages-page { display: flex; flex-direction: column; gap: 1.25rem; }
.list-skeleton { display: flex; flex-direction: column; gap: 0.5rem; }

.unread-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 22px; height: 22px; padding: 0 6px;
  background: linear-gradient(135deg, #8b5cf6, #6366f1);
  color: #fff; border-radius: 11px; font-size: 0.7rem; font-weight: 700;
  margin-left: 0.5rem; vertical-align: middle;
}

/* Layout split */
.messages-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 1rem;
  min-height: 520px;
}

/* ── Threads panel ── */
.threads-panel {
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.threads-header {
  padding: 0.875rem;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2);
}

.threads-search { width: 100%; }

.threads-empty {
  display: flex; flex-direction: column; align-items: center; gap: 0.5rem;
  padding: 3rem 1rem; color: #7c6fa0; font-size: 0.875rem;
}
.threads-empty .pi { font-size: 1.5rem; opacity: 0.4; }
.threads-empty p { margin: 0; }

.threads-list {
  list-style: none; margin: 0; padding: 0.375rem;
  display: flex; flex-direction: column; overflow-y: auto; flex: 1;
}

.thread-item {
  display: flex; align-items: flex-start; gap: 0.625rem;
  padding: 0.75rem; border-radius: 12px; cursor: pointer;
  border-left: 3px solid transparent; transition: background 0.15s;
  position: relative;
}

.thread-item:hover { background: rgba(167, 139, 250, 0.1); }
.thread-item:focus-visible { outline: 2px solid #8b5cf6; outline-offset: -2px; }
.thread-item--active { background: rgba(167, 139, 250, 0.15); border-left-color: #8b5cf6; }

.thread-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95; font-size: 0.65rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  text-transform: uppercase; flex-shrink: 0;
}
.thread-avatar--unread { background: linear-gradient(135deg, #8b5cf6, #6366f1); color: #fff; }

.thread-body { flex: 1; min-width: 0; }
.thread-top { display: flex; justify-content: space-between; align-items: baseline; gap: 0.25rem; }
.thread-subject { font-size: 0.8125rem; color: #1e1b4b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
.thread-subject--bold { font-weight: 700; }
.thread-date { font-size: 0.68rem; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
.thread-preview { font-size: 0.72rem; color: #7c6fa0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.thread-sender  { font-size: 0.68rem; color: #9ca3af; margin-top: 2px; }

.unread-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #8b5cf6; flex-shrink: 0; margin-top: 6px;
}

/* ── Detail panel ── */
.thread-detail {
  background: rgba(255, 255, 255, 0.48);
  backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 18px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
}

.thread-placeholder {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; flex: 1; gap: 1rem;
  color: #7c6fa0; text-align: center;
}
.placeholder-icon { font-size: 3rem; opacity: 0.25; }
.thread-placeholder p { margin: 0; font-size: 0.9rem; }

/* Message cards */
.msg-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 16px;
  padding: 1.25rem;
}

.msg-card--reply {
  margin-left: 1.5rem;
  border-left: 3px solid rgba(167, 139, 250, 0.4);
}

.msg-header { margin-bottom: 0.875rem; }
.msg-subject { margin: 0 0 0.625rem; font-size: 1.1rem; font-weight: 700; color: #1e1b4b; }
.msg-meta { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.msg-meta-row { display: flex; align-items: center; gap: 0.625rem; }
.msg-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95; font-size: 0.6rem; font-weight: 700;
  display: flex; align-items: center; justify-content: center; text-transform: uppercase;
}
.msg-avatar--sm { width: 24px; height: 24px; font-size: 0.55rem; }
.msg-from { font-size: 0.8125rem; font-weight: 600; color: #1e1b4b; }
.msg-to   { font-size: 0.75rem; color: #7c6fa0; margin-left: 0.25rem; }
.msg-date { font-size: 0.72rem; color: #9ca3af; }
.msg-content { margin: 0; font-size: 0.9rem; line-height: 1.65; white-space: pre-wrap; color: #374151; }
.msg-footer { display: flex; justify-content: flex-end; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(196, 181, 253, 0.15); }

/* Replies */
.replies-section { display: flex; flex-direction: column; gap: 0.75rem; }
.replies-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #7c6fa0; }
.no-replies { margin: 0; font-size: 0.85rem; color: #9ca3af; font-style: italic; }

/* Reply form */
.reply-form {
  background: rgba(237, 233, 254, 0.3);
  border: 1px solid rgba(196, 181, 253, 0.3);
  border-radius: 14px;
  padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
}
.reply-form-header { display: flex; align-items: center; }
.reply-form-label  { font-size: 0.8rem; font-weight: 600; color: #5b21b6; }
.reply-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }

/* Error */
.dash-error {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4); border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.875rem;
}

/* New message dialog */
:deep(.glass-dialog .p-dialog) {
  background: rgba(255, 255, 255, 0.72) !important; backdrop-filter: blur(24px) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important; border-radius: 20px !important;
}
:deep(.glass-dialog .p-dialog-header) {
  background: transparent !important; border-bottom: 1px solid rgba(196, 181, 253, 0.2) !important; padding: 1.25rem 1.5rem !important;
}
:deep(.glass-dialog .p-dialog-title) { font-size: 1.1rem !important; font-weight: 700 !important; color: #4c1d95 !important; }
:deep(.glass-dialog .p-dialog-content) { background: transparent !important; padding: 1.5rem !important; }

.new-msg-form { display: flex; flex-direction: column; gap: 1.25rem; }

.form-banner-error {
  display: flex; align-items: center; gap: 0.5rem;
  background: rgba(254, 202, 202, 0.45); border: 1px solid rgba(252, 165, 165, 0.5);
  color: #dc2626; border-radius: 12px; padding: 0.75rem 1rem; font-size: 0.875rem;
}

.field { display: flex; flex-direction: column; gap: 0.375rem; }
.field label { font-size: 0.75rem; font-weight: 600; color: #5b21b6; letter-spacing: 0.04em; text-transform: uppercase; }
.req { color: #ef4444; margin-left: 2px; }

.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(196, 181, 253, 0.2); }
</style>
