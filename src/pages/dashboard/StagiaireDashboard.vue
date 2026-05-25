<script setup lang="ts">
import Card from 'primevue/card'
import Tag from 'primevue/tag'
</script>

<template>
  <div>
    <div class="page-header">
      <h2>Mon espace stagiaire</h2>
      <Tag value="ROLE_USER" severity="secondary" />
    </div>

    <div class="stats-grid">
      <Card>
        <template #title>Formations en cours</template>
        <template #content><span class="stat-value">—</span></template>
      </Card>
      <Card>
        <template #title>Modules complétés</template>
        <template #content><span class="stat-value">—</span></template>
      </Card>
      <Card>
        <template #title>Ma progression</template>
        <template #content><span class="stat-value">—</span></template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.page-header h2 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}
.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--p-primary-color);
}
</style>
