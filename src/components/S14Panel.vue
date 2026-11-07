<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '../stores/dataset'
import { useSettingsStore } from '../stores/settings'
import { useMarksStore } from '../stores/marks'
import { computeS14Stats, type S14Stats } from '../core/stats'
import { DEFAULT_CLASSIFY_OPTS } from '../core/classify'

const dataset = useDatasetStore()
const settings = useSettingsStore()
const marks = useMarksStore()

// --- Filters ---
const filters = {
  nearThreshold: false,
  hasFreeCells: false,
  noTruncated: false
}

// --- Sorting ---
type SortKey = 'token' | 'stopCount' | 'gymCount' | 'totalPoi' | 'expectedGyms' | 'poiToNextThreshold' | 'freeS17Count'
type SortDir = 'asc' | 'desc'

const sortKey = ref<SortKey>('totalPoi')
const sortDir = ref<SortDir>('desc')

function toggleSort(key: SortKey): void {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
}

function sortIndicator(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ▲' : ' ▼'
}

// --- Stats ---
const stats = computed(() => {
  return computeS14Stats(dataset.pois, dataset.cells, {
    thresholds: { poiCounts: [2, 6, 20], gymCounts: [1, 2, 3] },
    classifyOpts: { ...DEFAULT_CLASSIFY_OPTS, powerspotCounts: settings.powerspotCounts },
    pendingTokens: marks.pendingTokens
  })
})

const rows = computed(() => {
  let items = Array.from(stats.value.values())

  // Apply filters
  if (filters.nearThreshold) {
    items = items.filter((s) => s.poiToNextThreshold === 1)
  }
  if (filters.hasFreeCells) {
    items = items.filter((s) => s.freeS17Count > 0)
  }
  if (filters.noTruncated) {
    items = items.filter((s) => !s.truncated)
  }

  // Sort
  const dir = sortDir.value === 'asc' ? 1 : -1
  items.sort((a, b) => {
    const va = a[sortKey.value]
    const vb = b[sortKey.value]
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir
    }
    return ((va as number) - (vb as number)) * dir
  })

  return items
})

// --- Emit zoom event ---
const emit = defineEmits<{
  zoomToS14: [token: string]
}>()

function onRowClick(s: S14Stats): void {
  emit('zoomToS14', s.token)
}
</script>

<template>
  <section class="panel-section">
    <h3>S14 Statistics</h3>

    <label class="toggle-row">
      <input type="checkbox" :checked="settings.showS14Stats" @change="settings.toggleShowS14Stats()" />
      <span>Stats mode (S14 fill)</span>
    </label>

    <div class="filter-row">
      <label class="filter-chip">
        <input v-model="filters.nearThreshold" type="checkbox" />
        <span>Near threshold (1)</span>
      </label>
      <label class="filter-chip">
        <input v-model="filters.hasFreeCells" type="checkbox" />
        <span>With free cells</span>
      </label>
      <label class="filter-chip">
        <input v-model="filters.noTruncated" type="checkbox" />
        <span>No truncated</span>
      </label>
    </div>

    <div class="stats-table-wrapper">
      <table class="stats-table">
        <thead>
          <tr>
            <th class="sortable" @click="toggleSort('stopCount')">Stop{{ sortIndicator('stopCount') }}</th>
            <th class="sortable" @click="toggleSort('gymCount')">Gym{{ sortIndicator('gymCount') }}</th>
            <th class="sortable" @click="toggleSort('totalPoi')">Total{{ sortIndicator('totalPoi') }}</th>
            <th class="sortable" @click="toggleSort('expectedGyms')">Est.{{ sortIndicator('expectedGyms') }}</th>
            <th class="sortable" @click="toggleSort('poiToNextThreshold')">Missing{{ sortIndicator('poiToNextThreshold')
            }}</th>
            <th class="sortable" @click="toggleSort('freeS17Count')">Free{{ sortIndicator('freeS17Count') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
v-for="s in rows" :key="s.token" class="stats-row" :class="{ truncated: s.truncated }"
            @click="onRowClick(s)">
            <td>{{ s.stopCount }}</td>
            <td>{{ s.gymCount }}</td>
            <td>{{ s.totalPoi }}</td>
            <td>{{ s.expectedGyms }}</td>
            <td>{{ s.poiToNextThreshold }}</td>
            <td>{{ s.freeS17Count }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="6" class="empty">No S14 with data</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="stats-note">
      Estimate: thresholds (2→1, 6→2, 20→3) are the community rule, not a guarantee.
    </p>
  </section>
</template>

<style scoped>
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0;
}

.filter-chip {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-chip input {
  margin: 0;
}

.stats-table-wrapper {
  max-height: 200px;
  overflow-y: auto;
  margin: 6px 0;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.stats-table th {
  position: sticky;
  top: 0;
  background: var(--bg-subtle);
  color: var(--text-primary);
  padding: 4px 6px;
  text-align: right;
  font-weight: 600;
  border-bottom: 1px solid var(--border-subtle);
  cursor: default;
}

.stats-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.stats-table th.sortable:hover {
  background: var(--bg-hover);
}

.stats-table td {
  padding: 3px 6px;
  text-align: right;
  border-bottom: 1px solid var(--bg-hover);
}

.stats-row {
  cursor: pointer;
}

.stats-row:hover {
  background: var(--accent-blue-bg);
}

.stats-row.truncated td {
  color: var(--accent-amber-text);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 12px;
}

.stats-note {
  font-size: 10px;
  color: var(--text-secondary);
  margin: 4px 0 0;
  line-height: 1.3;
}
</style>
