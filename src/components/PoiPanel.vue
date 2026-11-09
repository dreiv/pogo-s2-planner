<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import ToggleRow from './ToggleRow.vue'
import { useSettingsStore } from '../stores/settings'
import { POI_FULL_DETAIL_ZOOM } from '../config'

const settings = useSettingsStore()
</script>

<template>
  <CollapsibleSection id="poi" title="Points of interest (POI)">
    <ToggleRow
      :checked="settings.showPois"
      label="Show POI"
      term="poi"
      @toggle="settings.toggleShowPois()"
    />
    <ToggleRow
      indent
      :checked="settings.showGyms"
      :disabled="!settings.showPois"
      label="Show gyms"
      @toggle="settings.toggleShowGyms()"
    />
    <ToggleRow
      indent
      :checked="settings.showStops"
      :disabled="!settings.showPois"
      label="Show stops"
      @toggle="settings.toggleShowStops()"
    />
    <ToggleRow
      indent
      :checked="settings.showPowerSpots"
      :disabled="!settings.showPois"
      label="Show Power Spots"
      @toggle="settings.toggleShowPowerSpots()"
    />
    <ToggleRow
      indent
      :checked="settings.showOtherPois"
      :disabled="!settings.showPois"
      label="Show non-game POIs"
      term="nonGamePoi"
      @toggle="settings.toggleShowOtherPois()"
    />
    <p class="poi-note">
      Below zoom {{ POI_FULL_DETAIL_ZOOM }} only stops and gyms are drawn, thinned to one per small
      screen square (gyms first). Power Spots and non-game POIs appear when you zoom in further.
    </p>
  </CollapsibleSection>
</template>

<style scoped>
.poi-note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
