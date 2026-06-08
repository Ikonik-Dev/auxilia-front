<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { apiCategoriesGetCollection } from '@/api'
import type { FormationFormationRead, CategoryCategoryRead } from '@/api'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import Message from 'primevue/message'

const props = defineProps<{
  formation?: FormationFormationRead | null
  saving?: boolean
  saveError?: string | null
}>()

const emit = defineEmits<{
  submit: [payload: Record<string, unknown>]
  cancel: []
}>()

// ── Form state ──
const title = ref('')
const code = ref('')
const description = ref('')
const objectives = ref('')
const prerequisites = ref('')
const durationHours = ref<number | null>(null)
const maxCapacity = ref<number | null>(null)
const level = ref<string | null>(null)
const isActive = ref(true)
const categoryIri = ref<string | null>(null)

// ── Categories ──
const categories = ref<CategoryCategoryRead[]>([])
onMounted(async () => {
  const { data } = await apiCategoriesGetCollection()
  categories.value = data ?? []
})

const categoryOptions = computed(() =>
  categories.value.map((c) => ({ label: c.name, value: `/api/categories/${c.id}` })),
)

// ── Level options ──
const levelOptions = [
  { label: 'Débutant',       value: 'beginner' },
  { label: 'Intermédiaire',  value: 'intermediate' },
  { label: 'Avancé',         value: 'advanced' },
  { label: 'Expert',         value: 'expert' },
]

// ── Auto-slug from title ──
const slug = computed(() =>
  title.value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, ''),
)

// ── Populate form when editing ──
watch(
  () => props.formation,
  (f) => {
    if (!f) return
    title.value = f.title ?? ''
    code.value = f.code ?? ''
    description.value = f.description ?? ''
    objectives.value = f.objectives ?? ''
    prerequisites.value = f.prerequisites ?? ''
    durationHours.value = f.durationHours ?? null
    maxCapacity.value = f.maxCapacity ?? null
    level.value = f.level ?? null
    isActive.value = f.isActive ?? true
    categoryIri.value = f.category ? `/api/categories/${f.category.id}` : null
  },
  { immediate: true },
)

// ── Validation ──
const errors = ref<Record<string, string>>({})

function validate(): boolean {
  errors.value = {}
  if (!title.value.trim()) errors.value.title = 'Le titre est obligatoire.'
  if (!code.value.trim()) errors.value.code = 'Le code est obligatoire.'
  if (!description.value.trim()) errors.value.description = 'La description est obligatoire.'
  if (!objectives.value.trim()) errors.value.objectives = 'Les objectifs sont obligatoires.'
  return Object.keys(errors.value).length === 0
}

function handleSubmit() {
  if (!validate()) return
  emit('submit', {
    title: title.value.trim(),
    code: code.value.trim(),
    slug: slug.value,
    description: description.value.trim(),
    objectives: objectives.value.trim(),
    prerequisites: prerequisites.value.trim() || null,
    durationHours: durationHours.value,
    maxCapacity: maxCapacity.value,
    level: level.value,
    isActive: isActive.value,
    category: categoryIri.value,
    formateurs: [],
  })
}
</script>

<template>
  <form class="formation-form" novalidate @submit.prevent="handleSubmit">
    <Message v-if="saveError" severity="error" :closable="false" class="form-error">
      {{ saveError }}
    </Message>

    <div class="form-grid">
      <!-- Titre -->
      <div class="field field--full">
        <label for="ff-title">Titre <span class="required">*</span></label>
        <InputText
          id="ff-title"
          v-model="title"
          placeholder="Ex : Développement web fullstack"
          :invalid="!!errors.title"
          fluid
        />
        <small v-if="errors.title" class="field-error">{{ errors.title }}</small>
      </div>

      <!-- Code + Slug preview -->
      <div class="field">
        <label for="ff-code">Code <span class="required">*</span></label>
        <InputText
          id="ff-code"
          v-model="code"
          placeholder="Ex : DEV-WEB-01"
          :invalid="!!errors.code"
          fluid
        />
        <small v-if="errors.code" class="field-error">{{ errors.code }}</small>
      </div>

      <div class="field">
        <label>Slug (auto)</label>
        <div class="slug-preview">{{ slug || '—' }}</div>
      </div>

      <!-- Description -->
      <div class="field field--full">
        <label for="ff-desc">Description <span class="required">*</span></label>
        <Textarea
          id="ff-desc"
          v-model="description"
          rows="3"
          :invalid="!!errors.description"
          style="width: 100%"
        />
        <small v-if="errors.description" class="field-error">{{ errors.description }}</small>
      </div>

      <!-- Objectifs -->
      <div class="field field--full">
        <label for="ff-obj">Objectifs pédagogiques <span class="required">*</span></label>
        <Textarea
          id="ff-obj"
          v-model="objectives"
          rows="3"
          :invalid="!!errors.objectives"
          style="width: 100%"
        />
        <small v-if="errors.objectives" class="field-error">{{ errors.objectives }}</small>
      </div>

      <!-- Prérequis -->
      <div class="field field--full">
        <label for="ff-prereq">Prérequis</label>
        <Textarea id="ff-prereq" v-model="prerequisites" rows="2" style="width: 100%" />
      </div>

      <!-- Durée -->
      <div class="field">
        <label for="ff-duration">Durée (heures)</label>
        <InputNumber
          id="ff-duration"
          v-model="durationHours"
          :min="1"
          :max="10000"
          placeholder="Ex : 35"
          fluid
        />
      </div>

      <!-- Capacité max -->
      <div class="field">
        <label for="ff-capacity">Capacité max</label>
        <InputNumber
          id="ff-capacity"
          v-model="maxCapacity"
          :min="1"
          placeholder="Ex : 20"
          fluid
        />
      </div>

      <!-- Niveau -->
      <div class="field">
        <label for="ff-level">Niveau</label>
        <Select
          id="ff-level"
          v-model="level"
          :options="levelOptions"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner"
          fluid
        />
      </div>

      <!-- Catégorie -->
      <div class="field">
        <label for="ff-cat">Catégorie</label>
        <Select
          id="ff-cat"
          v-model="categoryIri"
          :options="categoryOptions"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner"
          fluid
        />
      </div>

      <!-- Statut actif -->
      <div class="field field--toggle">
        <label for="ff-active">Formation active</label>
        <ToggleSwitch id="ff-active" v-model="isActive" />
      </div>
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <Button
        type="button"
        label="Annuler"
        severity="secondary"
        text
        :disabled="saving"
        @click="emit('cancel')"
      />
      <Button
        type="submit"
        :label="formation ? 'Enregistrer' : 'Créer la formation'"
        icon="pi pi-check"
        :loading="saving"
      />
    </div>
  </form>
</template>

<style scoped>
.formation-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-error {
  margin-bottom: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.field--full {
  grid-column: 1 / -1;
}

.field--toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.35);
  border: 1px solid rgba(196, 181, 253, 0.3);
  border-radius: 12px;
  padding: 0.75rem 1rem;
}

.field label {
  font-size: 0.75rem;
  font-weight: 600;
  color: #5b21b6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.required {
  color: #b91c1c;
  margin-left: 2px;
}

.field-error {
  color: #b91c1c;
  font-size: 0.75rem;
}

.slug-preview {
  height: 2.5rem;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  background: rgba(237, 233, 254, 0.4);
  border: 1px dashed rgba(196, 181, 253, 0.5);
  border-radius: 10px;
  font-size: 0.8125rem;
  color: #675c9c;
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(196, 181, 253, 0.2);
}
</style>
