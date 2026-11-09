<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import ToggleRow from './ToggleRow.vue'
import InfoTip from './InfoTip.vue'
import SelectRow from './SelectRow.vue'
import { revealSection } from './scrollToSection'
import '../ui.css'
import { useSettingsStore } from '../stores/settings'
import { GYM_HINT_MAX_REMAINING_RANGE, GYM_HINT_MIN_COUNT_RANGE } from '../core/gymHints'

const settings = useSettingsStore()
</script>

<template>
  <CollapsibleSection id="grids" title="Grids">
    <template #tip><InfoTip term="s2" /></template>
    <ToggleRow
      :checked="settings.showS14"
      label="Gym-count cells (S14, ~0.6 km)"
      term="s14"
      @toggle="settings.toggleS14()"
    />
    <ToggleRow
      indent
      :checked="settings.showGymHints"
      label="Hint when a gym is about to appear"
      term="gymHint"
      @toggle="settings.toggleGymHints()"
    />
    <SelectRow
      v-if="settings.showGymHints"
      indent
      label="Stops and gyms needed in the cell"
      :model-value="settings.gymHintMinCount"
      :min="GYM_HINT_MIN_COUNT_RANGE[0]"
      :max="GYM_HINT_MIN_COUNT_RANGE[1]"
      @update:model-value="settings.setGymHintMinCount($event)"
    />
    <SelectRow
      v-if="settings.showGymHints"
      indent
      label="Show when this many or fewer are missing"
      :model-value="settings.gymHintMaxRemaining"
      :min="GYM_HINT_MAX_REMAINING_RANGE[0]"
      :max="GYM_HINT_MAX_REMAINING_RANGE[1]"
      @update:model-value="settings.setGymHintMaxRemaining($event)"
    />
    <ToggleRow
      :checked="settings.showS17"
      label="Stop-slot cells (S17, ~70 m)"
      term="s17"
      @toggle="settings.toggleS17()"
    />
    <button type="button" class="link-btn grids-link" @click="revealSection('legend')">
      Choose which cell colors to show
    </button>
  </CollapsibleSection>
</template>

<style scoped>
.grids-link {
  margin-top: 6px;
  font-size: 12px;
}
</style>
