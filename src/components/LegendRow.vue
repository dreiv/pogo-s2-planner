<script setup lang="ts">
import InfoTip from './InfoTip.vue'
import type { TermId } from '../glossary'
import '../ui.css'

// One legend entry. With `checked` it is also a toggle (checkbox + swatch + label), so the
// legend is the single place that explains a color AND switches it on or off.
withDefaults(
  defineProps<{
    label: string
    kind: 'fill' | 'line' | 'dot'
    color: string
    /** Fill swatches: the (translucent) tint drawn on the map. */
    background?: string
    /** Line swatches. */
    dash?: string
    weight?: number
    /** Renders a checkbox; `checked` is its state. Without it the row is a plain legend entry. */
    toggleable?: boolean
    checked?: boolean
    disabled?: boolean
    term?: TermId
  }>(),
  {
    background: undefined,
    dash: undefined,
    weight: 3,
    toggleable: false,
    checked: false,
    disabled: false,
    term: undefined
  }
)

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <div class="legend-line-row">
    <component
      :is="toggleable ? 'label' : 'div'"
      class="legend-item"
      :class="{ 'toggle-row': toggleable, static: !toggleable, disabled }"
    >
      <input
        v-if="toggleable"
        type="checkbox"
        :checked="checked"
        :disabled="disabled"
        @change="emit('toggle')"
      />
      <svg
        v-if="kind === 'line'"
        class="swatch"
        width="28"
        height="12"
        viewBox="0 0 28 12"
        aria-hidden="true"
      >
        <line
          x1="1"
          y1="6"
          x2="27"
          y2="6"
          :stroke="color"
          :stroke-width="weight"
          :stroke-dasharray="dash"
          stroke-linecap="round"
        />
      </svg>
      <span
        v-else-if="kind === 'dot'"
        class="swatch dot"
        :style="{ background: color }"
        aria-hidden="true"
      ></span>
      <span
        v-else
        class="swatch fill"
        :style="{ background, border: `1px solid ${color}` }"
        aria-hidden="true"
      ></span>
      <span>{{ label }}</span>
    </component>
    <InfoTip v-if="term" :term="term" />
  </div>
</template>

<style scoped>
.legend-line-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.legend-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-item.static {
  padding: 3px 0 3px 24px;
}

.legend-item.disabled {
  color: var(--text-secondary);
  cursor: default;
}

.swatch {
  flex-shrink: 0;
}

.swatch.fill {
  width: 28px;
  height: 12px;
  border-radius: 2px;
}

.swatch.dot {
  width: 12px;
  height: 12px;
  margin: 0 8px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--border);
}
</style>
