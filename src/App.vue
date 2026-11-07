<script setup lang="ts">
import { ref, onMounted } from 'vue'
import MapView from './components/MapView.vue'
import IntroGuide from './components/IntroGuide.vue'
import S14Panel from './components/S14Panel.vue'
import MarksPanel from './components/MarksPanel.vue'
import RangePanel from './components/RangePanel.vue'
import GridsPanel from './components/GridsPanel.vue'
import PoiPanel from './components/PoiPanel.vue'
import FieldPanel from './components/FieldPanel.vue'
import LegendPanel from './components/LegendPanel.vue'
import ImportPanel from './components/ImportPanel.vue'
import BackupPanel from './components/BackupPanel.vue'
import GlossaryPanel from './components/GlossaryPanel.vue'
import DangerZone from './components/DangerZone.vue'
import PwaUpdate from './components/PwaUpdate.vue'
import { useDatasetStore } from './stores/dataset'
import { useMarksStore } from './stores/marks'

const panelOpen = ref(false)
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

function onHighlightS14(token: string | null): void {
  mapViewRef.value?.highlightS14(token)
}
</script>

<template>
  <div id="app-root">
    <MapView ref="mapViewRef" @cell-selected="onCellSelected" />
    <aside class="side-panel" :class="{ open: panelOpen }" aria-label="Planner sidebar">
      <div class="panel-content">
        <h2>Pogo S2 Planner</h2>
        <IntroGuide />
        <S14Panel @zoom-to-s14="onZoomToS14" @highlight-s14="onHighlightS14" />
        <MarksPanel ref="marksPanelRef" />
        <RangePanel />
        <GridsPanel />
        <PoiPanel />
        <FieldPanel @move-range="mapViewRef?.moveRangeToPosition()" />
        <LegendPanel />
        <ImportPanel />
        <BackupPanel />
        <GlossaryPanel />
        <DangerZone />
      </div>
    </aside>
    <button
      class="panel-toggle" :class="{ open: panelOpen }"
      :aria-expanded="panelOpen" aria-label="Toggle sidebar"
      @click="panelOpen = !panelOpen">
      {{ panelOpen ? '✕' : '☰' }}
    </button>
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
  right: 0;
  width: 40px;
  height: 40px;
  border: none;
  background: var(--bg-panel);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  transition: right 0.2s ease;
}

.panel-toggle.open {
  right: 280px;
}

.panel-content {
  padding: 0 16px;
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
    top: auto;
    right: auto;
    bottom: env(safe-area-inset-bottom);
    left: 50%;
    transform: translateX(-50%);
    border-radius: 8px;
    width: 44px;
    height: 44px;
  }

  .panel-toggle.open {
    right: auto;
    bottom: calc(60vh + env(safe-area-inset-bottom));
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
