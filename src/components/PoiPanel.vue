<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import ToggleRow from './ToggleRow.vue'
import { useSettingsStore } from '../stores/settings'

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
  </CollapsibleSection>
</template>
