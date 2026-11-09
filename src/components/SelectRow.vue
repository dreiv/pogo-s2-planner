<script setup lang="ts">
import { useId } from 'vue'
import '../ui.css'

defineProps<{
  modelValue: number
  label: string
  /** Every integer from min to max is offered. */
  min: number
  max: number
  /** Appended to each option, e.g. "stops and gyms". */
  unit?: string
  disabled?: boolean
  indent?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const id = useId()

function onChange(e: Event): void {
  emit('update:modelValue', Number((e.target as HTMLSelectElement).value))
}
</script>

<template>
  <div class="select-line" :class="{ indent, disabled }">
    <label :for="id" class="select-label">{{ label }}</label>
    <select
      :id="id"
      class="select-input"
      :value="modelValue"
      :disabled="disabled"
      @change="onChange"
    >
      <option v-for="n in max - min + 1" :key="n" :value="min + n - 1">
        {{ min + n - 1 }}{{ unit ? ` ${unit}` : '' }}
      </option>
    </select>
  </div>
</template>

<style scoped>
.select-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  font-size: 14px;
}

.select-line.indent {
  padding-left: 24px;
}

.select-line.disabled {
  color: var(--text-secondary);
}

.select-label {
  flex: 1;
  line-height: 1.3;
}

.select-input {
  flex: none;
  min-width: 56px;
  font: inherit;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-panel);
  color: var(--text-primary);
  min-height: 32px;
}
</style>
