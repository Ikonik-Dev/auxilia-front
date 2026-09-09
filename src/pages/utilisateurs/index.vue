<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
// `useAuthStore` n'est plus importe ici : la page ne lit plus les roles elle-meme,
// `useUserCapabilities` encapsule cette lecture (et la table de niveaux qui va avec).
import { useUserCapabilities, ROLE_LABELS } from '@/composables/useUserCapabilities'
import { useUtilisateurs } from '@/composables/useUtilisateurs'
import type { UserFormPayload } from '@/composables/useUtilisateurs'
import UserForm from '@/components/utilisateurs/UserForm.vue'
import type { UserUserRead, UserUserWrite } from '@/api'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Skeleton from 'primevue/skeleton'
import { useToast } from 'primevue/usetoast'
import Toast from 'primevue/toast'

const toast = useToast()
const { utilisateurs, loading, error, fetchUtilisateurs, createUser, updateUser, deleteUser } = useUtilisateurs()

// Phase 17 etape 4 — capacites par cible, miroir de UserVoter.
//
// `isAdmin` et `canWrite` ont disparu. Le premier fermait la page a tout le monde sauf
// ROLE_ADMIN — un directeur voyait l'entree de menu, cliquait, et tombait sur « Acces
// reserve ». Le second incluait ROLE_DIRECTEUR sans que cela ne decide jamais rien : tout
// ce qu'il gardait vivait dans la branche `v-else` de `!isAdmin`, atteignable par le seul
// ROLE_ADMIN. Sa clause `|| ROLE_DIRECTEUR` etait du code mort.
const { canOpenPage, canCreate, canEdit, canDelete } = useUserCapabilities()

onMounted(() => {
  document.title = 'Utilisateurs — Auxilium'
  // ⚠ Le fetch suit la MEME condition que le `v-if` du template. Les desynchroniser
  // rouvrirait le defaut d'aujourd'hui a l'envers : page ouverte, liste jamais demandee.
  if (canOpenPage.value) fetchUtilisateurs()
})

// ── Filtres ──
const search = ref('')
const filterRole = ref('all')
const filterStatus = ref<'all' | 'active' | 'inactive'>('all')

// ⚠ ROLE_SECRETARIAT ajoute le 9 septembre 2026. Sans lui, `displayRoles()` le filtrait
// et Nadia Benali s'affichait « Stagiaire » alors que l'API rend bien
// ["ROLE_SECRETARIAT","ROLE_USER"] (mesure sur /api/auth/me).
const KNOWN_ROLES = ['ROLE_ADMIN', 'ROLE_DIRECTEUR', 'ROLE_SECRETARIAT', 'ROLE_RESPONSABLE_PED', 'ROLE_FORMATEUR', 'ROLE_USER']

// Ordonne du niveau le plus eleve au plus bas, comme les tables de UserVoter.
const roleOptions = [
  { label: 'Tous les rôles',      value: 'all' },
  { label: 'Superviseur',         value: 'ROLE_ADMIN' },
  { label: 'Directeur',           value: 'ROLE_DIRECTEUR' },
  { label: 'Secrétariat',         value: 'ROLE_SECRETARIAT' },
  { label: 'Responsable péda.',   value: 'ROLE_RESPONSABLE_PED' },
  { label: 'Formateur',           value: 'ROLE_FORMATEUR' },
  { label: 'Stagiaire',           value: 'ROLE_USER' },
]
const statusOptions = [
  { label: 'Tous',     value: 'all' },
  { label: 'Actifs',   value: 'active' },
  { label: 'Inactifs', value: 'inactive' },
]

const filtered = computed(() => {
  let list = utilisateurs.value
  const q = search.value.trim().toLowerCase()
  if (q) list = list.filter((u) =>
    u.firstName.toLowerCase().includes(q) ||
    u.lastName.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q),
  )
  if (filterRole.value !== 'all') list = list.filter((u) => u.roles.includes(filterRole.value))
  if (filterStatus.value === 'active')   list = list.filter((u) => u.isActive)
  if (filterStatus.value === 'inactive') list = list.filter((u) => !u.isActive)
  return list
})

// ── Helpers ──
// ROLE_LABELS a demenage dans `composables/useUserCapabilities.ts` le 9 septembre 2026 :
// il a desormais DEUX consommateurs — les badges ci-dessous et les options de UserForm —
// et le relabel « Superviseur » ne doit pas pouvoir diverger entre les deux ecrans.
//
// ⚠ ROLE_SEVERITY, lui, RESTE ICI, et ce n'est pas un oubli de symetrie : il n'a qu'un seul
// consommateur (le badge de :245) et son type est celui de PrimeVue. Le deplacer ferait
// entrer une dependance a la bibliotheque d'interface dans un module d'autorisation.
// A deplacer le jour ou un deuxieme ecran en aura besoin, pas avant.
const ROLE_SEVERITY: Record<string, 'danger' | 'warn' | 'info' | 'secondary'> = {
  ROLE_ADMIN:           'danger',
  ROLE_DIRECTEUR:       'warn',
  ROLE_SECRETARIAT:     'info',
  ROLE_RESPONSABLE_PED: 'info',
  ROLE_FORMATEUR:       'info',
  ROLE_USER:            'secondary',
}

function displayRoles(roles: Array<string | null>) {
  return roles.filter((r): r is string => r !== null && KNOWN_ROLES.includes(r))
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR')
}

// ── Dialog création / édition ──
const showForm = ref(false)
const editTarget = ref<UserUserRead | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

function openCreate() {
  editTarget.value = null
  saveError.value = null
  showForm.value = true
}

function openEdit(user: UserUserRead) {
  editTarget.value = user
  saveError.value = null
  showForm.value = true
}

async function handleSubmit(payload: UserFormPayload) {
  saving.value = true
  saveError.value = null
  try {
    if (editTarget.value?.id) {
      await updateUser(editTarget.value.id, payload)
      toast.add({ severity: 'success', summary: 'Utilisateur modifié', life: 3000 })
    } else {
      await createUser(payload as UserUserWrite)
      toast.add({ severity: 'success', summary: 'Utilisateur créé', life: 3000 })
    }
    showForm.value = false
    await fetchUtilisateurs()
  } catch (erreur) {
    // Le composable remonte le motif réel (violation de validation, refus de droits).
    // Un message générique rendait un email déjà pris indiscernable d'un 403.
    saveError.value =
      erreur instanceof Error && erreur.message !== ''
        ? erreur.message
        : 'Une erreur est survenue. Vérifiez les données et réessayez.'
  } finally {
    saving.value = false
  }
}

// ── Dialog suppression ──
const showDeleteConfirm = ref(false)
const deleteTarget = ref<UserUserRead | null>(null)
const deleting = ref(false)

function openDelete(user: UserUserRead) {
  deleteTarget.value = user
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (!deleteTarget.value?.id) return
  deleting.value = true
  const ok = await deleteUser(deleteTarget.value.id)
  deleting.value = false
  if (ok) {
    toast.add({ severity: 'success', summary: 'Utilisateur supprimé', life: 3000 })
    showDeleteConfirm.value = false
    await fetchUtilisateurs()
  } else {
    toast.add({ severity: 'error', summary: 'Suppression impossible', life: 4000 })
    showDeleteConfirm.value = false
  }
}
</script>

<template>
  <div v-if="!canOpenPage" class="access-denied" role="alert">
    <i class="pi pi-lock access-denied-icon" aria-hidden="true" />
    <!-- ⚠ <h1>, pas <h2> : cette branche n'avait AUCUN <h1>, le titre de niveau 1 ne
         vivant qu'en :172 dans la branche autorisée. Un compte refusé recevait donc une
         page sans <h1>. Les deux branches sont exclusives (v-if / v-else) : il n'y a
         jamais deux <h1> à l'écran. -->
    <h1>Accès réservé</h1>
    <p>Cette page est réservée aux personnes chargées de la gestion des comptes.</p>
  </div>

  <div v-else class="utilisateurs-page" :aria-busy="loading ? 'true' : undefined">
    <Toast />

    <div class="page-header">
      <h1>Utilisateurs</h1>
      <!-- Miroir de USER_CREATE sans sujet : plafond >= 1. Écarte formateur et stagiaire. -->
      <Button v-if="canCreate" label="Nouvel utilisateur" icon="pi pi-user-plus" @click="openCreate" />
    </div>

    <!-- Erreur chargement -->
    <div v-if="error" role="alert" aria-live="polite" class="dash-error">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" /> {{ error }}
    </div>

    <!-- Chargement -->
    <div v-else-if="loading" class="list-skeleton" aria-label="Chargement des utilisateurs">
      <Skeleton v-for="i in 6" :key="i" height="2.75rem" border-radius="10px" />
    </div>

    <!-- Contenu -->
    <template v-else>
      <div class="filters">
        <InputText
          v-model="search"
          placeholder="Rechercher par nom ou email…"
          aria-label="Rechercher un utilisateur"
          class="filter-search"
        />
        <Select
          v-model="filterRole"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par rôle"
          class="filter-role"
        />
        <Select
          v-model="filterStatus"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          aria-label="Filtrer par statut"
          class="filter-status"
        />
      </div>

      <DataTable
        :value="filtered"
        paginator
        :rows="20"
        :rows-per-page-options="[10, 20, 50]"
        aria-label="Liste des utilisateurs"
        class="glass-table"
      >
        <template #empty>
          <div class="empty-state">
            <i class="pi pi-users" />
            <p>Aucun utilisateur trouvé.</p>
          </div>
        </template>

        <Column header="Nom" sortable sort-field="lastName" style="min-width: 180px">
          <template #body="{ data }">
            <div class="user-cell">
              <div class="user-avatar-sm">{{ data.firstName[0] }}{{ data.lastName[0] }}</div>
              <span>{{ data.firstName }} {{ data.lastName }}</span>
            </div>
          </template>
        </Column>

        <Column field="email" header="Email" style="min-width: 200px" />

        <Column header="Rôles" style="min-width: 200px">
          <template #body="{ data }">
            <div class="role-tags">
              <Tag
                v-for="role in displayRoles(data.roles)"
                :key="role"
                :value="ROLE_LABELS[role] ?? role"
                :severity="ROLE_SEVERITY[role] ?? 'secondary'"
              />
            </div>
          </template>
        </Column>

        <Column header="Statut" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="data.isActive ? 'Actif' : 'Inactif'" :severity="data.isActive ? 'success' : 'secondary'" />
          </template>
        </Column>

        <Column header="Dernière connexion" style="width: 160px">
          <template #body="{ data }">{{ formatDate(data.lastLoginAt) }}</template>
        </Column>

        <Column header="Créé le" style="width: 110px">
          <template #body="{ data }">{{ formatDate(data.createdAt) }}</template>
        </Column>

        <!-- ⚠ CHOIX C — la colonne est toujours rendue (tout compte qui atteint la page
             peut au moins éditer SA fiche), mais chaque bouton suit la capacité DE LA
             LIGNE. Un formateur voit ses 17 ou 19 stagiaires SANS crayon : mesuré côté
             API, GET 200 / PATCH 403. Une colonne « tout ou rien » promettrait une action
             que l'API refuse. -->
        <Column header="" style="width: 90px">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                v-if="canEdit(data)"
                icon="pi pi-pencil"
                text
                rounded
                severity="secondary"
                size="small"
                aria-label="Modifier l'utilisateur"
                @click.stop="openEdit(data)"
              />
              <Button
                v-if="canDelete(data)"
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                size="small"
                aria-label="Supprimer l'utilisateur"
                @click.stop="openDelete(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </template>

    <!-- Dialog création / édition -->
    <Dialog
      v-model:visible="showForm"
      modal
      :header="editTarget ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'"
      :style="{ width: '620px', maxWidth: '95vw' }"
      :draggable="false"
      class="glass-dialog"
    >
      <UserForm
        :user="editTarget"
        :saving="saving"
        :save-error="saveError"
        @submit="handleSubmit"
        @cancel="showForm = false"
      />
    </Dialog>

    <!-- Dialog suppression -->
    <Dialog
      v-model:visible="showDeleteConfirm"
      modal
      header="Supprimer l'utilisateur"
      :style="{ width: '420px' }"
      :draggable="false"
      class="glass-dialog"
    >
      <p class="delete-msg">
        Supprimer <strong>{{ deleteTarget?.firstName }} {{ deleteTarget?.lastName }}</strong> ?
        L'utilisateur sera désactivé (soft delete) et ne pourra plus se connecter.
      </p>
      <div class="delete-actions">
        <Button label="Annuler" severity="secondary" text @click="showDeleteConfirm = false" />
        <Button label="Supprimer" icon="pi pi-trash" severity="danger" :loading="deleting" @click="handleDelete" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.access-denied {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 300px;
  color: #675c9c;
  text-align: center;
}
.access-denied-icon { font-size: 3rem; opacity: 0.3; }
.access-denied h2 { margin: 0; font-size: 1.2rem; color: #4c1d95; }
.access-denied p { margin: 0; font-size: 0.9rem; }

.utilisateurs-page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.list-skeleton {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filters {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-search { flex: 1; min-width: 200px; }
.filter-role, .filter-status { width: 180px; }

/* Table glass */
.glass-table {
  background: rgba(255, 255, 255, 0.45) !important;
  backdrop-filter: blur(14px);
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.55);
}

:deep(.p-datatable-header-cell) {
  background: rgba(237, 233, 254, 0.6) !important;
  color: #5b21b6 !important;
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.3) !important;
}

:deep(.p-datatable-tbody > tr) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.12) !important;
  transition: background 0.15s;
}

:deep(.p-datatable-tbody > tr:hover) {
  background: rgba(167, 139, 250, 0.07) !important;
}

/* User avatar initials */
.user-cell {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.user-avatar-sm {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4b5fd, #93c5fd);
  color: #4c1d95;
  font-size: 0.625rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-transform: uppercase;
}

.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.row-actions {
  display: flex;
  gap: 0.25rem;
  justify-content: flex-end;
}

/* Error / empty */
.dash-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(254, 202, 202, 0.4);
  border: 1px solid rgba(252, 165, 165, 0.5);
  color: #b91c1c;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #675c9c;
}

.empty-state .pi { font-size: 2rem; opacity: 0.4; }
.empty-state p { margin: 0; font-size: 0.9rem; }

/* Dialogs */
:deep(.glass-dialog .p-dialog) {
  background: rgba(255, 255, 255, 0.72) !important;
  backdrop-filter: blur(24px) !important;
  border: 1px solid rgba(255, 255, 255, 0.65) !important;
  border-radius: 20px !important;
}

:deep(.glass-dialog .p-dialog-header) {
  background: transparent !important;
  border-bottom: 1px solid rgba(196, 181, 253, 0.2) !important;
  padding: 1.25rem 1.5rem !important;
}

:deep(.glass-dialog .p-dialog-title) {
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  color: #4c1d95 !important;
}

:deep(.glass-dialog .p-dialog-content) {
  background: transparent !important;
  padding: 1.5rem !important;
}

.delete-msg {
  margin: 0 0 1.5rem;
  color: #374151;
  line-height: 1.6;
}

.delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
