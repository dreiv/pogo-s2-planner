<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import ToggleRow from './ToggleRow.vue'
import { useSettingsStore } from '../stores/settings'

const settings = useSettingsStore()
</script>

<template>
  <CollapsibleSection id="grids" title="S2 grids">
    <ToggleRow
      :checked="settings.showS14"
      label="Gym-count cells (S14, ~0.6 km)"
      term="s14"
      @toggle="settings.toggleS14()"
    />
    <ToggleRow
      :checked="settings.showS17"
      label="Stop-slot cells (S17, ~70 m)"
      term="s17"
      @toggle="settings.toggleS17()"
    />
  </CollapsibleSection>
</template>
