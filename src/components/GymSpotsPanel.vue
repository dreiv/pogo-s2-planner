<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import InfoTip from './InfoTip.vue'
import { useDatasetStore } from '../stores/dataset'
import { useMapFocusStore } from '../stores/mapFocus'
import { useSettingsStore } from '../stores/settings'
import {
  filterGymHints,
  gymHintLabel,
  gymHintText,
  sortGymHints,
  type GymHintCell
} from '../core/gymHints'
import '../ui.css'

const emit = defineEmits<{ navigate: [] }>()

const dataset = useDatasetStore()
const settings = useSettingsStore()
const focus = useMapFocusStore()

/** Zoom the map jumps to: high enough that every badge allowed by the settings is drawn. */
const FOCUS_ZOOM = 15
/** Rows drawn; the closest cells come first, so the rest matter less. */
const MAX_ROWS = 40

const spots = computed(() =>
  sortGymHints(
    filterGymHints(dataset.gymHints, {
      minCount: settings.gymHintMinCount,
      maxRemaining: settings.gymHintMaxRemaining
    })
  )
)
const rows = computed(() => spots.value.slice(0, MAX_ROWS))

function go(cell: GymHintCell): void {
  focus.focusOn(cell.lat, cell.lng, FOCUS_ZOOM)
  emit('navigate')
}
</script>

<template>
  <CollapsibleSection id="gymspots" title="Gym opportunities">
    <template #tip><InfoTip term="gymHint" /></template>
    <p v-if="spots.length === 0" class="empty">
      No S14 cell is close to its next gym. A cell shows up here from
      {{ settings.gymHintMinCount }} stops and gyms, when {{ settings.gymHintMaxRemaining }} or
      fewer more would unlock the next one.
    </p>
    <template v-else>
      <p class="count">
        {{ spots.length }} cell{{ spots.length === 1 ? '' : 's' }} close to a gym, closest first.
      </p>
      <ul class="spots">
        <li v-for="cell in rows" :key="cell.token">
          <button type="button" class="spot" :title="gymHintText(cell)" @click="go(cell)">
            <span class="spot-badge" :class="{ partial: cell.partial }">{{
              gymHintLabel(cell)
            }}</span>
            <span class="spot-meta">
              {{ cell.hint.count }} stops and gyms<template v-if="cell.partial">
                · data may be incomplete</template
              >
            </span>
          </button>
        </li>
      </ul>
      <p v-if="spots.length > rows.length" class="count">
        Showing the closest {{ rows.length }}; lower “at most N more” to narrow the list.
      </p>
    </template>
  </CollapsibleSection>
</template>

<style scoped>
.empty,
.count {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.spots {
  list-style: none;
  margin: 0 0 6px;
  padding: 0;
  max-height: 260px;
  overflow-y: auto;
}

.spot {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 4px;
  border: 0;
  border-bottom: 1px solid var(--border-subtle);
  background: none;
  font: inherit;
  font-size: 13px;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  min-height: 36px;
}

.spot:hover {
  background: var(--bg-hover);
}

.spot-badge {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: #b91c1c;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.spot-badge.partial {
  background: var(--bg-panel);
  color: #b91c1c;
  border: 1px dashed #b91c1c;
}

.spot-meta {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
