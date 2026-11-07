<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MapView from './components/MapView.vue'
import ImportPanel from './components/ImportPanel.vue'
import RangePanel from './components/RangePanel.vue'
import S14Panel from './components/S14Panel.vue'
import MarksPanel from './components/MarksPanel.vue'
import BackupPanel from './components/BackupPanel.vue'
import PwaUpdate from './components/PwaUpdate.vue'
import { useSettingsStore } from './stores/settings'
import { useDatasetStore } from './stores/dataset'
import { useMarksStore } from './stores/marks'
import {
  CELL_STATE_COLORS,
  S14_STATS_COLORS,
  GRID_STROKE,
  withAlpha
} from './theme'

const panelOpen = ref(false)
const settings = useSettingsStore()
const dataset = useDatasetStore()
const marks = useMarksStore()
const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)
const marksPanelRef = ref<InstanceType<typeof MarksPanel> | null>(null)

onMounted(() => {
  dataset.load().catch(console.error)
  marks.load().catch(console.error)
})

function onCellSelected(token: string): void {
  marksPanelRef.value?.selectCell(token)
}

function onZoomToS14(token: string): void {
  mapViewRef.value?.zoomToS14(token)
}

// --- Legend swatches (colors from theme tokens) ---
interface LegendItem {
  label: string
  background: string
  border: string
  dashed?: boolean
}

const s17Legend: LegendItem[] = [
  {
    label: 'Occupied (active stop/gym)',
    background: withAlpha(CELL_STATE_COLORS.occupied, 0.35),
    border: CELL_STATE_COLORS.occupied
  },
  {
    label: 'Free',
    background: withAlpha(CELL_STATE_COLORS.free, 0.25),
    border: CELL_STATE_COLORS.free
  },
  {
    label: 'Free (uncertain – S14 truncated)',
    background: withAlpha(CELL_STATE_COLORS['free-uncertain'], 0.3),
    border: CELL_STATE_COLORS['free-uncertain'],
    dashed: true
  },
  {
    label: 'Unknown (no data)',
    background: 'transparent',
    border: GRID_STROKE.s17
  }
]

const s14Legend: LegendItem[] = [
  {
    label: 'At threshold (0 POI missing)',
    background: withAlpha(S14_STATS_COLORS.atThreshold, 0.3),
    border: S14_STATS_COLORS.atThreshold
  },
  {
    label: '1 POI missing',
    background: withAlpha(S14_STATS_COLORS.nearThreshold, 0.3),
    border: S14_STATS_COLORS.nearThreshold
  },
  {
    label: '2+ POI missing',
    background: withAlpha(S14_STATS_COLORS.farThreshold, 0.3),
    border: S14_STATS_COLORS.farThreshold
  }
]
</script>

<template>
  <div id="app-root">
    <MapView ref="mapViewRef" @cell-selected="onCellSelected" />
    <aside class="side-panel" :class="{ open: panelOpen }">
      <button class="panel-toggle" @click="panelOpen = !panelOpen">
        {{ panelOpen ? '✕' : '☰' }}
      </button>
      <div class="panel-content">
        <h2>Pogo S2 Planner</h2>
        <section class="panel-section">
          <h3>Map</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.satelliteView" @change="settings.toggleSatelliteView()" />
            <span>Satellite view</span>
          </label>
        </section>
        <section class="panel-section">
          <h3>S2 Grids</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showS14" @change="settings.toggleS14()" />
            <span>S14 grid (~0.6 km)</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showS17" @change="settings.toggleS17()" />
            <span>S17 grid (~70 m)</span>
          </label>
        </section>
        <section class="panel-section">
          <h3>POI</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showPois" @change="settings.toggleShowPois()" />
            <span>Show POI</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showOtherPois" @change="settings.toggleShowOtherPois()" />
            <span>Show "other"</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.stopGymOnly" @change="settings.toggleStopGymOnly()" />
            <span>Stop/gym only</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.powerspotCounts" @change="settings.togglePowerspotCounts()" />
            <span>Powerspot = occupied</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showPoiImages" @change="settings.toggleShowPoiImages()" />
            <span>Show POI photos</span>
          </label>
        </section>
        <section class="panel-section">
          <h3>Field</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.fieldMode"
              @change="settings.setFieldMode(($event.target as HTMLInputElement).checked)" />
            <span>Track location (GPS)</span>
          </label>
          <label v-if="settings.fieldMode" class="toggle-row">
            <input type="checkbox" :checked="settings.followPosition" @change="settings.toggleFollowPosition()" />
            <span>Follow location</span>
          </label>
          <button v-if="settings.fieldMode" class="field-range-btn" @click="mapViewRef?.moveRangeToPosition()">
            Move range center to position
          </button>
        </section>
        <section v-if="settings.showS14Stats" class="panel-section">
          <h3>S14 Legend (stats)</h3>
          <div v-for="item in s14Legend" :key="item.label" class="legend-row">
            <span class="legend-swatch"
              :style="{ background: item.background, border: `1px ${item.dashed ? 'dashed' : 'solid'} ${item.border}` }"></span>
            <span>{{ item.label }}</span>
          </div>
        </section>
        <section class="panel-section">
          <h3>S17 Legend</h3>
          <div v-for="item in s17Legend" :key="item.label" class="legend-row">
            <span class="legend-swatch"
              :style="{ background: item.background, border: `1px ${item.dashed ? 'dashed' : 'solid'} ${item.border}` }"></span>
            <span>{{ item.label }}</span>
          </div>
        </section>
        <S14Panel @zoom-to-s14="onZoomToS14" />
        <MarksPanel ref="marksPanelRef" />
        <RangePanel />
        <ImportPanel />
        <BackupPanel />
      </div>
    </aside>
    <PwaUpdate />
  </div>
</template>

<style>
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
  background: var(--bg-app);
  color: var(--text-primary);
}

#app-root {
  position: relative;
  width: 100vw;
  height: 100vh;
}

.side-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: var(--bg-panel);
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  transform: translateX(100%);
  transition: transform 0.2s ease;
  z-index: 2000;
  display: flex;
  flex-direction: column;
}

.side-panel.open {
  transform: translateX(0);
}

.panel-toggle {
  position: absolute;
  top: 12px;
  left: -40px;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.panel-content {
  padding: 60px 16px 16px;
  overflow-y: auto;
  flex: 1;
}

.placeholder {
  color: var(--text-secondary);
  font-size: 14px;
}

.panel-section {
  margin-bottom: 16px;
}

.panel-section h3 {
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 8px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  padding: 4px 0;
  cursor: pointer;
}

.toggle-row input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 3px 0;
}

.legend-swatch {
  width: 18px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.field-range-btn {
  width: 100%;
  margin-top: 8px;
  min-height: 44px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-subtle);
  font-size: 13px;
  cursor: pointer;
}

.field-range-btn:hover {
  background: var(--bg-hover);
}

.leaflet-control-zoom a.leaflet-disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: default;
}

/* --- Dark theme (follows system) ---
   Surface colors come from theme.css tokens (which switch in dark mode).
   Only Leaflet's own classes and the locate button need explicit overrides. */
@media (prefers-color-scheme: dark) {
  .side-panel {
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.4);
  }

  /* Leaflet controls */
  .leaflet-control-zoom a {
    background: var(--bg-panel);
    color: var(--text-primary);
    border-color: var(--border-subtle);
  }

  .leaflet-control-zoom a:hover,
  .leaflet-control-zoom a:focus {
    background: var(--bg-hover);
    color: var(--text-primary);
    outline: none;
  }

  .leaflet-control-attribution {
    background: rgba(31, 41, 55, 0.8);
    color: var(--text-secondary);
  }

  .leaflet-control-attribution a {
    color: #60a5fa;
  }

  .locate-btn {
    background: var(--bg-panel);
    color: var(--text-primary);
  }
}

/* --- Mobile: bottom-sheet + larger touch targets --- */
@media (max-width: 640px) {
  .side-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 60vh;
    transform: translateY(100%);
    border-radius: 16px 16px 0 0;
  }

  .side-panel.open {
    transform: translateY(0);
  }

  .panel-toggle {
    top: -44px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 8px 8px 0 0;
    width: 44px;
    height: 44px;
  }

  .panel-content {
    padding: 16px 16px 24px;
  }

  .toggle-row {
    min-height: 44px;
    padding: 0;
  }

  .toggle-row input[type="checkbox"] {
    width: 20px;
    height: 20px;
  }
}
</style>
