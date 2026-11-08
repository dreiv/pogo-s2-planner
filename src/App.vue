<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import MapView from './components/MapView.vue'
import IntroGuide from './components/IntroGuide.vue'
import MarksPanel from './components/MarksPanel.vue'
import RangePanel from './components/RangePanel.vue'
import GridsPanel from './components/GridsPanel.vue'
import PoiPanel from './components/PoiPanel.vue'
import LegendPanel from './components/LegendPanel.vue'
import ImportPanel from './components/ImportPanel.vue'
import BackupPanel from './components/BackupPanel.vue'
import GlossaryPanel from './components/GlossaryPanel.vue'
import DangerZone from './components/DangerZone.vue'
import DataSummary from './components/DataSummary.vue'
import PwaUpdate from './components/PwaUpdate.vue'
import { useDatasetStore } from './stores/dataset'
import { useMarksStore } from './stores/marks'

const panelOpen = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const dataset = useDatasetStore()
const marks = useMarksStore()
const marksPanelRef = ref<InstanceType<typeof MarksPanel> | null>(null)

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && panelOpen.value && !e.defaultPrevented) {
    panelOpen.value = false
  }
}

// Focus follows the panel: into it on open, back to the toggle on close
// (only when focus was inside, so closing by clicking the map does not steal it).
watch(panelOpen, async (open) => {
  const hadFocusInside = panelRef.value?.contains(document.activeElement) ?? false
  await nextTick()
  if (open) panelRef.value?.focus({ preventScroll: true })
  else if (hadFocusInside) toggleRef.value?.focus()
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  // dataset.load() records failures in loadError; the banner below surfaces them.
  dataset.load().catch(console.error)
  marks.load().catch(console.error)
})

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

function onCellSelected(token: string): void {
  marksPanelRef.value?.selectCell(token)
}
</script>

<template>
  <div id="app-root">
    <MapView @cell-selected="onCellSelected" />
    <div
      v-if="dataset.loadError || dataset.storageError"
      class="storage-banner"
      role="alert"
    >
      <span v-if="dataset.loadError">
        Could not read saved data ({{ dataset.loadError }}). The app is running with an empty,
        unsaved dataset.
      </span>
      <span v-else>
        Could not save to this browser ({{ dataset.storageError }}). Your changes are kept only
        until you reload; export a backup.
      </span>
    </div>
    <aside
      id="side-panel"
      ref="panelRef"
      class="side-panel"
      :class="{ open: panelOpen }"
      :inert="panelOpen ? undefined : true"
      tabindex="-1"
      aria-label="Planner sidebar"
    >
      <div class="panel-content">
        <h2>Pogo S2 Planner</h2>
        <IntroGuide />
        <GridsPanel />
        <PoiPanel />
        <MarksPanel ref="marksPanelRef" />
        <RangePanel />
        <LegendPanel />
        <h2 class="group-title">Data &amp; advanced</h2>
        <DataSummary />
        <ImportPanel />
        <BackupPanel />
        <GlossaryPanel />
        <DangerZone />
      </div>
    </aside>
    <button
      ref="toggleRef"
      class="panel-toggle"
      :class="{ open: panelOpen }"
      :aria-expanded="panelOpen"
      aria-controls="side-panel"
      aria-label="Toggle sidebar"
      @click="panelOpen = !panelOpen"
    >
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
  height: 100dvh;
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
  border-radius: 8px 0 0 8px;
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

.side-panel:focus {
  outline: none;
}

.panel-content {
  padding: 0 16px;
  overflow-y: auto;
  flex: 1;
}

.storage-banner {
  position: absolute;
  top: calc(8px + env(safe-area-inset-top));
  left: 56px;
  right: 56px;
  z-index: 1500;
  padding: 8px 12px;
  border: 1px solid var(--accent-red);
  border-radius: 8px;
  background: var(--accent-red-bg);
  color: var(--accent-red-text);
  font-size: 13px;
  line-height: 1.35;
}

.placeholder {
  color: var(--text-secondary);
  font-size: 14px;
}

.panel-section {
  margin-bottom: 16px;
}

.group-title {
  margin: 24px 0 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
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

.leaflet-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

.leaflet-control-zoom a.leaflet-disabled {
  background: var(--bg-hover);
  color: var(--text-muted);
  cursor: default;
}

@media (prefers-reduced-motion: reduce) {
  .side-panel,
  .panel-toggle {
    transition: none;
  }

  .leaflet-zoom-anim .leaflet-zoom-animated {
    transition: none !important;
  }
}

@media (pointer: coarse) {
  .panel-toggle {
    min-width: 44px;
    min-height: 44px;
  }
}

@media (prefers-color-scheme: dark) {
  .side-panel {
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.4);
  }

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

@media (max-width: 640px) {
  .side-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 60vh;
    height: 60dvh;
    transform: translateY(100%);
    border-radius: 16px 16px 0 0;
  }

  .side-panel.open {
    transform: translateY(0);
  }

  .panel-toggle {
    top: auto;
    right: auto;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 12px 12px 0 0;
    width: 56px;
    height: calc(40px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
  }

  .panel-toggle.open {
    right: auto;
    bottom: 60vh;
    bottom: 60dvh;
    padding-bottom: 0;
    height: 40px;
  }

  .panel-content {
    padding: 12px 12px calc(24px + env(safe-area-inset-bottom));
  }

  .storage-banner {
    left: 12px;
    right: 12px;
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
