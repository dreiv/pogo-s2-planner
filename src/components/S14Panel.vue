<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import InfoTip from './InfoTip.vue'
import ToggleRow from './ToggleRow.vue'
import { revealSection } from './scrollToSection'
import { useDatasetStore } from '../stores/dataset'
import { useSettingsStore } from '../stores/settings'
import { useMarksStore } from '../stores/marks'
import { computeS14Stats, DEFAULT_THRESHOLDS, type S14Stats } from '../core/stats'
import { DEFAULT_CLASSIFY_OPTS } from '../core/classify'
import { GYM_TIERS_TEXT, TERMS } from '../glossary'
import '../ui.css'

type SortKey =
  | 'token'
  | 'stopCount'
  | 'gymCount'
  | 'totalPoi'
  | 'expectedGyms'
  | 'poiToNextThreshold'
  | 'freeS17Count'
type SortDir = 'asc' | 'desc'

const columns: { key: SortKey; label: string; full: string }[] = [
  { key: 'token', label: 'Cell', full: 'S14 cell' },
  { key: 'stopCount', label: 'Stops', full: 'Pokéstops in the cell' },
  { key: 'gymCount', label: 'Gyms', full: 'Gyms in the cell now' },
  { key: 'totalPoi', label: 'POIs', full: 'POIs in the cell' },
  { key: 'expectedGyms', label: 'Est. gyms', full: 'Gyms expected' },
  { key: 'poiToNextThreshold', label: 'To next', full: 'POIs to next gym' },
  { key: 'freeS17Count', label: 'Free', full: 'Free S17 cells' }
]

const dataset = useDatasetStore()
const settings = useSettingsStore()
const marks = useMarksStore()

const filters = reactive({
  nearThreshold: false,
  hasFreeCells: false,
  noTruncated: false
})

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

function ariaSort(key: SortKey): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key) return 'none'
  return sortDir.value === 'asc' ? 'ascending' : 'descending'
}

function sortArrow(key: SortKey): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? '▲' : '▼'
}

const stats = computed(() =>
  computeS14Stats(dataset.pois, dataset.cells, {
    thresholds: DEFAULT_THRESHOLDS,
    classifyOpts: DEFAULT_CLASSIFY_OPTS,
    pendingTokens: marks.pendingTokens
  })
)

const allStats = computed(() => Array.from(stats.value.values()))

function isNear(s: S14Stats): boolean {
  return s.poiToNextThreshold === 1
}

const counts = computed(() => ({
  near: allStats.value.filter(isNear).length,
  free: allStats.value.filter((s) => s.freeS17Count > 0).length,
  complete: allStats.value.filter((s) => !s.truncated).length,
  opportunities: allStats.value.filter((s) => isNear(s) && s.freeS17Count > 0).length
}))

const anyFilter = computed(
  () => filters.nearThreshold || filters.hasFreeCells || filters.noTruncated
)

const opportunitiesOn = computed(() => filters.nearThreshold && filters.hasFreeCells)

function toggleOpportunities(): void {
  const next = !opportunitiesOn.value
  filters.nearThreshold = next
  filters.hasFreeCells = next
}

function clearFilters(): void {
  filters.nearThreshold = false
  filters.hasFreeCells = false
  filters.noTruncated = false
}

const rows = computed(() => {
  let items = allStats.value.slice()
  if (filters.nearThreshold) items = items.filter(isNear)
  if (filters.hasFreeCells) items = items.filter((s) => s.freeS17Count > 0)
  if (filters.noTruncated) items = items.filter((s) => !s.truncated)

  const dir = sortDir.value === 'asc' ? 1 : -1
  const key = sortKey.value
  items.sort((a, b) => {
    const va = a[key]
    const vb = b[key]
    if (typeof va === 'string' && typeof vb === 'string') {
      return va.localeCompare(vb) * dir
    }
    return ((va as number) - (vb as number)) * dir
  })
  return items
})

const emit = defineEmits<{
  zoomToS14: [token: string]
  highlightS14: [token: string | null]
}>()

function shortToken(token: string): string {
  return token.slice(-8)
}

function zoomTo(s: S14Stats): void {
  emit('zoomToS14', s.token)
}

function highlight(token: string | null): void {
  emit('highlightS14', token)
}

const columnKey = [
  { label: 'Cell', text: 'The S14 cell. Hover or focus a row to outline it on the map, click to zoom to it.' },
  { label: 'Stops, Gyms', text: 'Active Pokéstops and gyms found in the cell.' },
  TERMS.totalPoi,
  { label: 'Est. gyms', text: TERMS.gymsExpected.text },
  TERMS.toNextGym,
  TERMS.freeCells,
  { label: '⚠ Incomplete data', text: TERMS.incompleteData.text }
]
</script>

<template>
  <CollapsibleSection id="stats" title="S14 statistics" default-open>
    <template #tip><InfoTip term="s14" /></template>

    <p class="lead">
      Find S14 cells that are close to the next gym tier and still have free S17 cells.
    </p>

    <ToggleRow
      :checked="settings.showS14Stats"
      label="Color S14 cells on the map by stats"
      term="statsMode"
      @toggle="settings.toggleShowS14Stats()"
    />
    <p v-if="settings.showS14Stats && !settings.showS14" class="hint">
      Turn on the S14 grid to see the colors.
    </p>

    <div class="filters" role="group" aria-label="Filter S14 cells">
      <button
        type="button"
        class="ui-btn ui-btn--block opportunities"
        :class="{ 'ui-btn--pressed': opportunitiesOn }"
        :aria-pressed="opportunitiesOn"
        @click="toggleOpportunities"
      >
        Show opportunities ({{ counts.opportunities }})
      </button>
      <div class="chips">
        <label class="filter-chip">
          <input v-model="filters.nearThreshold" type="checkbox" />
          <span>1 POI from next gym ({{ counts.near }})</span>
        </label>
        <label class="filter-chip">
          <input v-model="filters.hasFreeCells" type="checkbox" />
          <span>Has free cells ({{ counts.free }})</span>
        </label>
        <label class="filter-chip">
          <input v-model="filters.noTruncated" type="checkbox" />
          <span>Complete data only ({{ counts.complete }})</span>
        </label>
      </div>
    </div>

    <p class="result-count" aria-live="polite">
      Showing {{ rows.length }} of {{ allStats.length }} S14 cells
      <button v-if="anyFilter" type="button" class="link-btn" @click="clearFilters">
        Clear filters
      </button>
    </p>

    <p v-if="allStats.length === 0" class="empty">
      No data yet.
      <button type="button" class="link-btn" @click="revealSection('import')">
        Import your Wayfarer data
      </button>
      to see S14 cells here.
    </p>

    <div
      v-else
      class="stats-table-wrapper"
      role="region"
      aria-label="S14 statistics table"
      tabindex="0"
    >
      <table class="stats-table">
        <thead>
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :class="{ 'cell-col': col.key === 'token' }"
              :aria-sort="ariaSort(col.key)"
            >
              <button
                type="button"
                class="sort-btn"
                :aria-label="col.full"
                :title="col.full"
                @click="toggleSort(col.key)"
              >
                <span>{{ col.label }}</span>
                <span class="arrow" aria-hidden="true">{{ sortArrow(col.key) }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in rows"
            :key="s.token"
            class="stats-row"
            :class="{ near: isNear(s), incomplete: s.truncated }"
            @pointerenter="highlight(s.token)"
            @pointerleave="highlight(null)"
            @click="zoomTo(s)"
          >
            <th scope="row" class="cell-col">
              <button
                type="button"
                class="cell-btn"
                :aria-label="`Zoom to S14 cell ${shortToken(s.token)}${s.truncated ? ', incomplete data' : ''}`"
                @focus="highlight(s.token)"
                @blur="highlight(null)"
                @click.stop="zoomTo(s)"
              >
                <code>{{ shortToken(s.token) }}</code>
                <span v-if="s.truncated" class="flag" aria-hidden="true">⚠</span>
              </button>
            </th>
            <td>{{ s.stopCount }}</td>
            <td>{{ s.gymCount }}</td>
            <td>{{ s.totalPoi }}</td>
            <td>{{ s.expectedGyms }}</td>
            <td class="to-next">{{ s.poiToNextThreshold }}</td>
            <td>{{ s.freeS17Count }}</td>
          </tr>
          <tr v-if="rows.length === 0">
            <td colspan="7" class="empty">No S14 cells match these filters.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <details class="column-key">
      <summary>What do the columns mean?</summary>
      <dl>
        <template v-for="item in columnKey" :key="item.label">
          <dt>{{ item.label }}</dt>
          <dd>{{ item.text }}</dd>
        </template>
      </dl>
    </details>

    <p class="stats-note">Gym estimate uses the community rule ({{ GYM_TIERS_TEXT }}). Not a guarantee.</p>
  </CollapsibleSection>
</template>

<style scoped>
.lead {
  margin: 0 0 6px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.hint {
  margin: 2px 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.filters {
  margin: 8px 0 6px;
}

.opportunities {
  margin-bottom: 6px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--bg-hover);
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.filter-chip input {
  margin: 0;
}

.result-count {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 8px;
  margin: 6px 0;
  font-size: 12px;
  color: var(--text-secondary);
}

.stats-table-wrapper {
  max-height: 240px;
  overflow: auto;
  margin: 6px 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.stats-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 0;
  background: var(--bg-subtle);
  border-bottom: 1px solid var(--border-subtle);
  font-weight: 600;
  text-align: right;
  vertical-align: bottom;
}

.sort-btn {
  display: inline-flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 2px;
  width: 100%;
  min-height: 32px;
  padding: 4px 6px;
  border: 0;
  background: none;
  color: var(--text-primary);
  font: inherit;
  line-height: 1.2;
  text-align: right;
  cursor: pointer;
}

.sort-btn:hover {
  background: var(--bg-hover);
}

.arrow {
  font-size: 9px;
}

.stats-table td,
.stats-table tbody th {
  padding: 2px 6px;
  border-bottom: 1px solid var(--bg-hover);
  text-align: right;
  font-weight: 400;
}

.stats-table .cell-col {
  text-align: left;
  padding-left: 4px;
}

.stats-table thead .cell-col .sort-btn {
  justify-content: flex-start;
  text-align: left;
}

.cell-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--accent-blue-text);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.stats-row:hover,
.stats-row:focus-within {
  background: var(--accent-blue-bg);
}

.stats-row {
  cursor: pointer;
}

.stats-row.near .cell-col {
  box-shadow: inset 3px 0 0 var(--accent-blue);
}

.stats-row.near .to-next {
  font-weight: 700;
}

.stats-row.incomplete td {
  color: var(--accent-amber-text);
}

.flag {
  color: var(--accent-amber-text);
}

.empty {
  padding: 8px 4px;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}

p.empty {
  margin: 6px 0;
  text-align: left;
}

.column-key {
  margin: 6px 0;
  font-size: 12px;
}

.column-key summary {
  min-height: 24px;
  cursor: pointer;
  color: var(--accent-blue-text);
}

.column-key dl {
  margin: 6px 0 0;
  line-height: 1.4;
}

.column-key dt {
  margin-top: 6px;
  font-weight: 600;
}

.column-key dd {
  margin: 2px 0 0;
  color: var(--text-secondary);
}

.stats-note {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
