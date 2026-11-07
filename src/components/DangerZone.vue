<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import { useDatasetStore } from '../stores/dataset'
import '../ui.css'

const dataset = useDatasetStore()

async function handleClear(): Promise<void> {
  const message =
    `Delete ${dataset.pois.length} POIs, ${dataset.cells.length} cells and ` +
    `${dataset.imports.length} import records from this browser?\n\n` +
    'Your marks and settings are kept. This cannot be undone. ' +
    'Export a backup with the dataset first if you may need this data again.'
  if (!confirm(message)) return
  await dataset.clearAll()
}
</script>

<template>
  <CollapsibleSection id="danger" title="Danger zone">
    <p class="danger-text">
      Removes all imported Wayfarer data (POIs, cells and import history) from this browser. Your
      marks and settings are kept.
    </p>
    <button
      type="button"
      class="ui-btn ui-btn--danger ui-btn--block"
      :disabled="dataset.pois.length === 0 && dataset.cells.length === 0"
      @click="handleClear"
    >
      Delete all imported data
    </button>
  </CollapsibleSection>
</template>

<style scoped>
.danger-text {
  margin: 0 0 8px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
