<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import LegendRow from './LegendRow.vue'
import { useSettingsStore } from '../stores/settings'
import {
  CELL_FILL_OPACITY,
  CELL_STATE_COLORS,
  GRID_STROKE,
  MARK_STATUS_COLORS,
  POI_COLORS,
  withAlpha
} from '../theme'
import {
  MARK_OUTLINE_WEIGHT,
  MARK_STATUS_DASH,
  MARK_STATUS_LABELS,
  MARK_STATUS_ORDER
} from '../markStyle'
import { isCellStateVisible } from '../core/cellVisibility'
import type { CellState } from '../core/classify'
import type { TermId } from '../glossary'
import '../ui.css'

const settings = useSettingsStore()

interface CellRow {
  state: CellState
  label: string
  term?: TermId
}

// Order: what matters most for picking a spot first.
const cellRows: CellRow[] = [
  { state: 'occupied', label: 'Occupied (active stop or gym)' },
  { state: 'free', label: 'Free (a new stop could fit)' },
  { state: 'free-uncertain', label: 'Free, data may be incomplete', term: 'incompleteData' },
  { state: 'unknown', label: 'No data (area not imported)', term: 'noData' }
]

const markRows = MARK_STATUS_ORDER.map((status) => ({
  status,
  label: MARK_STATUS_LABELS[status],
  color: MARK_STATUS_COLORS[status],
  dash: MARK_STATUS_DASH[status]
}))

const poiRows = [
  { label: 'Stop', color: POI_COLORS.stop },
  { label: 'Gym', color: POI_COLORS.gym },
  { label: 'Power Spot', color: POI_COLORS.powerspot },
  { label: 'Non-game POI', color: POI_COLORS.other }
]
</script>

<template>
  <CollapsibleSection id="legend" title="Map legend & layers">
    <h4 class="legend-title">S17 cell colors (tick to show)</h4>
    <LegendRow
      v-for="row in cellRows"
      :key="row.state"
      kind="fill"
      toggleable
      :label="row.label"
      :color="CELL_STATE_COLORS[row.state]"
      :background="withAlpha(CELL_STATE_COLORS[row.state], CELL_FILL_OPACITY[row.state])"
      :checked="isCellStateVisible(row.state, settings)"
      :disabled="!settings.showS17"
      :term="row.term"
      @toggle="settings.toggleCellState(row.state)"
    />

    <h4 class="legend-title">Your marks (outline, tick to show)</h4>
    <LegendRow
      v-for="row in markRows"
      :key="row.status"
      kind="line"
      toggleable
      :label="row.label"
      :color="row.color"
      :dash="row.dash"
      :weight="MARK_OUTLINE_WEIGHT"
      :checked="!settings.hiddenMarkStatuses.includes(row.status)"
      :disabled="!settings.showS17"
      @toggle="settings.toggleMarkStatus(row.status)"
    />
    <p v-if="!settings.showS17" class="legend-note">
      Turn on the S17 grid under Grids to use these.
    </p>

    <h4 class="legend-title">Points (dots)</h4>
    <LegendRow
      v-for="row in poiRows"
      :key="row.label"
      kind="dot"
      :label="row.label"
      :color="row.color"
    />

    <h4 class="legend-title">Grid lines</h4>
    <LegendRow kind="line" label="S14 cell (~0.6 km)" :color="GRID_STROKE.s14" :weight="2" />
    <LegendRow
      kind="line"
      label="S17 cell (~70 m)"
      :color="GRID_STROKE.s17"
      :weight="1"
      dash="3 3"
    />
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

.legend-note {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
