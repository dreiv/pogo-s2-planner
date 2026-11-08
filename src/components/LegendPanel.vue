<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import { CELL_FILL_OPACITY, CELL_STATE_COLORS, MARK_STATUS_COLORS, withAlpha } from '../theme'
import { MARK_OUTLINE_WEIGHT, MARK_STATUS_DASH, MARK_STATUS_LABELS, MARK_STATUS_ORDER } from '../markStyle'

interface LegendItem {
  label: string
  background: string
  border: string
  dashed?: boolean
}

const s17Legend: LegendItem[] = [
  {
    label: 'Occupied (active stop or gym)',
    background: withAlpha(CELL_STATE_COLORS.occupied, CELL_FILL_OPACITY.occupied),
    border: CELL_STATE_COLORS.occupied
  },
  {
    label: 'Free, but incomplete data (S14 cell may be cut off)',
    background: withAlpha(CELL_STATE_COLORS['free-uncertain'], CELL_FILL_OPACITY['free-uncertain']),
    border: CELL_STATE_COLORS['free-uncertain']
  }
]

const markLegend = MARK_STATUS_ORDER.map((status) => ({
  status,
  label: MARK_STATUS_LABELS[status],
  color: MARK_STATUS_COLORS[status],
  dash: MARK_STATUS_DASH[status]
}))
</script>

<template>
  <CollapsibleSection id="legend" title="Map legend">
    <h4 class="legend-title">S17 cells (fill)</h4>
    <div v-for="item in s17Legend" :key="item.label" class="legend-row">
      <span
        class="legend-swatch"
        :style="{
          background: item.background,
          border: `1px ${item.dashed ? 'dashed' : 'solid'} ${item.border}`
        }"
      ></span>
      <span>{{ item.label }}</span>
    </div>

    <h4 class="legend-title">Your marks (outline)</h4>
    <div v-for="item in markLegend" :key="item.status" class="legend-row">
      <svg class="legend-line" width="28" height="12" viewBox="0 0 28 12" aria-hidden="true">
        <line
          x1="1"
          y1="6"
          x2="27"
          y2="6"
          :stroke="item.color"
          :stroke-width="MARK_OUTLINE_WEIGHT"
          :stroke-dasharray="item.dash"
          stroke-linecap="round"
        />
      </svg>
      <span>{{ item.label }}</span>
    </div>
  </CollapsibleSection>
</template>

<style scoped>
.legend-title {
  margin: 10px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.legend-title:first-child {
  margin-top: 0;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 13px;
}

.legend-swatch {
  flex-shrink: 0;
  width: 28px;
  height: 12px;
  border-radius: 2px;
}

.legend-line {
  flex-shrink: 0;
}
</style>
