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
      :checked="settings.showOtherPois"
      :disabled="!settings.showPois"
      label="Show non-game POIs"
      term="nonGamePoi"
      @toggle="settings.toggleShowOtherPois()"
    />
    <ToggleRow
      indent
      :checked="settings.stopGymOnly"
      :disabled="!settings.showPois"
      label="Stops and gyms only"
      @toggle="settings.toggleStopGymOnly()"
    />
    <ToggleRow
      indent
      :checked="settings.showPoiImages"
      :disabled="!settings.showPois"
      label="Show POI photos"
      @toggle="settings.toggleShowPoiImages()"
    />
    <p class="poi-note">
      Below zoom {{ POI_FULL_DETAIL_ZOOM }} only stops and gyms are drawn. Power Spots and non-game
      POIs appear when you zoom in further.
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
