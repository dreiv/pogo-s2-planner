<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import { useSettingsStore } from '../stores/settings'
import {
  CELL_STATE_COLORS,
  GRID_STROKE,
  MARK_STATUS_COLORS,
  S14_STATS_COLORS,
  withAlpha
} from '../theme'
import { MARK_OUTLINE_WEIGHT, MARK_STATUS_DASH, MARK_STATUS_LABELS, MARK_STATUS_ORDER } from '../markStyle'

interface LegendItem {
  label: string
  background: string
  border: string
  dashed?: boolean
}

const settings = useSettingsStore()

const s17Legend: LegendItem[] = [
  {
    label: 'Occupied (active stop or gym)',
    background: withAlpha(CELL_STATE_COLORS.occupied, 0.35),
    border: CELL_STATE_COLORS.occupied
  },
  {
    label: 'Free',
    background: withAlpha(CELL_STATE_COLORS.free, 0.25),
    border: CELL_STATE_COLORS.free
  },
  {
    label: 'Free, but the S14 data may be incomplete',
    background: withAlpha(CELL_STATE_COLORS['free-uncertain'], 0.3),
    border: CELL_STATE_COLORS['free-uncertain'],
    dashed: true
  },
  {
    label: 'No data',
    background: 'transparent',
    border: GRID_STROKE.s17
  }
]

const s14Legend: LegendItem[] = [
  {
    label: 'Top gym tier reached',
    background: withAlpha(S14_STATS_COLORS.atThreshold, 0.3),
    border: S14_STATS_COLORS.atThreshold
  },
  {
    label: '1 POI short of the next tier',
    background: withAlpha(S14_STATS_COLORS.nearThreshold, 0.3),
    border: S14_STATS_COLORS.nearThreshold
  },
  {
    label: '2 or more POIs short',
    background: withAlpha(S14_STATS_COLORS.farThreshold, 0.3),
    border: S14_STATS_COLORS.farThreshold
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
  <CollapsibleSection id="legend" title="Map legend" default-open>
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

    <template v-if="settings.showS14Stats">
      <h4 class="legend-title">S14 cells (fill, stats mode)</h4>
      <div v-for="item in s14Legend" :key="item.label" class="legend-row">
        <span
          class="legend-swatch"
          :style="{ background: item.background, border: `1px solid ${item.border}` }"
        ></span>
        <span>{{ item.label }}</span>
      </div>
    </template>

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
