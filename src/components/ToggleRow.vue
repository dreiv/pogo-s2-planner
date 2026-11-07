<script setup lang="ts">
import InfoTip from './InfoTip.vue'
import type { TermId } from '../glossary'
import '../ui.css'

defineProps<{
  checked: boolean
  label: string
  term?: TermId
  disabled?: boolean
  indent?: boolean
}>()

const emit = defineEmits<{ toggle: [checked: boolean] }>()

function onChange(e: Event): void {
  emit('toggle', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <div class="toggle-line" :class="{ indent }">
    <label class="toggle-row" :class="{ disabled }">
      <input type="checkbox" :checked="checked" :disabled="disabled" @change="onChange" />
      <span>{{ label }}</span>
    </label>
    <InfoTip v-if="term" :term="term" />
  </div>
</template>

<style scoped>
.toggle-line {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-line.indent {
  padding-left: 24px;
}

.toggle-line .toggle-row {
  flex: 1;
}

.toggle-row.disabled {
  color: var(--text-secondary);
  cursor: default;
}
</style>
