<script setup lang="ts">
import type { MilestoneMilestoneRead } from '@/api'

defineProps<{ milestones: MilestoneMilestoneRead[] }>()

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isLate(milestone: MilestoneMilestoneRead): boolean {
  return !milestone.isCompleted && new Date(milestone.targetDate) < new Date()
}
</script>

<template>
  <div v-if="milestones.length === 0" class="milestones-empty">
    <i class="pi pi-flag" />
    <span>Aucun jalon défini pour ce parcours.</span>
  </div>

  <ol v-else class="milestones-list" aria-label="Jalons du parcours">
    <li
      v-for="ms in milestones"
      :key="ms.id"
      class="milestone-item"
      :class="{
        'milestone--completed': ms.isCompleted,
        'milestone--late':      isLate(ms),
      }"
    >
      <!-- Indicateur -->
      <div class="milestone-indicator">
        <div class="milestone-dot">
          <i v-if="ms.isCompleted" class="pi pi-check" />
          <i v-else-if="isLate(ms)" class="pi pi-exclamation-triangle" />
        </div>
        <div class="milestone-line" />
      </div>

      <!-- Contenu -->
      <div class="milestone-content">
        <div class="milestone-header">
          <span class="milestone-title">{{ ms.title }}</span>
          <span
            class="milestone-status"
            :class="ms.isCompleted ? 'status--done' : isLate(ms) ? 'status--late' : 'status--pending'"
          >
            {{ ms.isCompleted ? 'Atteint' : isLate(ms) ? 'En retard' : 'En cours' }}
          </span>
        </div>

        <div class="milestone-dates">
          <span class="date-target">
            <i class="pi pi-calendar" /> Cible : {{ fmtDate(ms.targetDate) }}
          </span>
          <span v-if="ms.completedDate" class="date-completed">
            <i class="pi pi-check-circle" /> Atteint le : {{ fmtDate(ms.completedDate) }}
          </span>
        </div>

        <p v-if="ms.notes" class="milestone-notes">{{ ms.notes }}</p>
      </div>
    </li>
  </ol>
</template>

<style scoped>
.milestones-empty {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 1rem 0;
}

.milestones-empty .pi { opacity: 0.4; }

.milestones-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.milestone-item {
  display: flex;
  gap: 1rem;
  position: relative;
}

.milestone-item:last-child .milestone-line { display: none; }

/* Indicateur gauche */
.milestone-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.milestone-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(196, 181, 253, 0.3);
  border: 2px solid rgba(196, 181, 253, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  color: #7c6fa0;
  z-index: 1;
  transition: all 0.2s;
}

.milestone--completed .milestone-dot {
  background: linear-gradient(135deg, #86efac, #6ee7b7);
  border-color: #86efac;
  color: #15803d;
}

.milestone--late .milestone-dot {
  background: linear-gradient(135deg, #fca5a5, #f87171);
  border-color: #fca5a5;
  color: #991b1b;
}

.milestone-line {
  flex: 1;
  width: 2px;
  background: rgba(196, 181, 253, 0.3);
  margin: 4px 0;
  min-height: 24px;
}

/* Contenu */
.milestone-content {
  flex: 1;
  padding-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.milestone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.milestone-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #1e1b4b;
}

.milestone-status {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 10px;
}

.status--done    { background: rgba(134, 239, 172, 0.25); color: #15803d; }
.status--late    { background: rgba(252, 165, 165, 0.25); color: #dc2626; }
.status--pending { background: rgba(196, 181, 253, 0.25); color: #6d28d9; }

.milestone-dates {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  font-size: 0.75rem;
  color: #7c6fa0;
}

.milestone-dates .pi { font-size: 0.65rem; }
.date-completed { color: #15803d; }

.milestone-notes {
  font-size: 0.8125rem;
  color: #4b5563;
  margin: 0;
  font-style: italic;
}
</style>
