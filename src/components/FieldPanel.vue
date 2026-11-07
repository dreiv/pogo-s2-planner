<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import ToggleRow from './ToggleRow.vue'
import { useSettingsStore } from '../stores/settings'
import '../ui.css'

const settings = useSettingsStore()

const emit = defineEmits<{ moveRange: [] }>()
</script>

<template>
  <CollapsibleSection id="field" title="Field">
    <ToggleRow
      :checked="settings.fieldMode"
      label="Show my location (GPS)"
      term="location"
      @toggle="settings.setFieldMode($event)"
    />
    <template v-if="settings.fieldMode">
      <ToggleRow
        :checked="settings.followPosition"
        label="Keep the map centered on me"
        @toggle="settings.toggleFollowPosition()"
      />
      <button type="button" class="ui-btn ui-btn--block move-btn" @click="emit('moveRange')">
        Move range center to my position
      </button>
    </template>
  </CollapsibleSection>
</template>

<style scoped>
.move-btn {
  margin-top: 8px;
}
</style>
