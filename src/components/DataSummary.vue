<script setup lang="ts">
import { computed } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import { useDatasetStore } from '../stores/dataset'
import { formatSnapshotDate, summarizeDataset } from '../core/datasetSummary'
import '../ui.css'

const dataset = useDatasetStore()

const summary = computed(() => summarizeDataset(dataset.pois, dataset.cells))
const isEmpty = computed(() => summary.value.poiCount === 0 && summary.value.cellCount === 0)

const n = (v: number): string => v.toLocaleString('en-US')

const text = computed(() => {
  const s = summary.value
  let out = `${n(s.poiCount)} POIs in ${n(s.cellCount)} S14 cells`
  if (s.incompleteCellCount > 0) out += `, ${n(s.incompleteCellCount)} of them with incomplete data`
  const date = formatSnapshotDate(s.latestSnapshot)
  if (date) out += `. Snapshot: ${date}`
  return `${out}.`
})
</script>

<template>
  <CollapsibleSection id="data" title="Loaded data">
    <p v-if="isEmpty" class="summary">
      No data loaded. Import a Wayfarer export to see which cells are occupied.
    </p>
    <template v-else>
      <p class="summary">{{ text }}</p>
      <p class="note">
        This is a sample of the area, not every POI in the city. Cells outside it show as “No
        data”, not as free.
      </p>
    </template>
  </CollapsibleSection>
</template>

<style scoped>
.summary {
  margin: 0 0 6px;
  font-size: 13px;
  line-height: 1.4;
}

.note {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
