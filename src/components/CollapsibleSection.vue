<script setup lang="ts">
import { computed, useId } from 'vue'
import { useUiStore } from '../stores/ui'
import '../ui.css'

const props = withDefaults(
  defineProps<{
    id: string
    title: string
    defaultOpen?: boolean
  }>(),
  { defaultOpen: false }
)

const ui = useUiStore()
const bodyId = useId()
const open = computed(() => ui.openSections[props.id] ?? props.defaultOpen)

function toggle(): void {
  ui.setOpen(props.id, !open.value)
}
</script>

<template>
  <section :id="`section-${id}`" class="panel-section">
    <div class="section-head">
      <h3 class="section-title">
        <button
          type="button"
          class="section-toggle"
          :aria-expanded="open"
          :aria-controls="bodyId"
          @click="toggle"
        >
          <span class="chevron" :class="{ open }" aria-hidden="true">▸</span>
          <span>{{ title }}</span>
        </button>
      </h3>
      <slot name="tip" />
    </div>
    <div v-show="open" :id="bodyId" class="section-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.section-head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.section-head .section-title {
  flex: 1;
  margin: 0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--text-secondary);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-transform: inherit;
  letter-spacing: inherit;
  cursor: pointer;
}

.section-toggle:hover {
  color: var(--text-primary);
}

.chevron {
  display: inline-block;
  transition: transform 0.15s ease;
}

.chevron.open {
  transform: rotate(90deg);
}

.section-body {
  padding-top: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

@media (pointer: coarse) {
  .section-toggle {
    min-height: 44px;
  }
}
</style>
