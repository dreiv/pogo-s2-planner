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
          <h3>Grile S2</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showS14" @change="settings.toggleS14()" />
            <span>Grilă S14 (~0.6 km)</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showS17" @change="settings.toggleS17()" />
            <span>Grilă S17 (~70 m)</span>
          </label>
        </section>
        <section class="panel-section">
          <h3>POI</h3>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showPois" @change="settings.toggleShowPois()" />
            <span>Afișează POI</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.showOtherPois" @change="settings.toggleShowOtherPois()" />
            <span>Afișează „other"</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.stopGymOnly" @change="settings.toggleStopGymOnly()" />
            <span>Doar stop/gym</span>
          </label>
          <label class="toggle-row">
            <input type="checkbox" :checked="settings.powerspotCounts" @change="settings.togglePowerspotCounts()" />
            <span>Powerspot = ocupat</span>
          </label>
        </section>
        <section class="panel-section">
          <h3>În teren</h3>
          <label class="toggle-row">
            <input
type="checkbox" :checked="settings.fieldMode"
              @change="settings.setFieldMode(($event.target as HTMLInputElement).checked)" />
            <span>Urmărire locație (GPS)</span>
          </label>
          <label v-if="settings.fieldMode" class="toggle-row">
            <input type="checkbox" :checked="settings.followPosition" @change="settings.toggleFollowPosition()" />
            <span>Pană la locație</span>
          </label>
          <button v-if="settings.fieldMode" class="field-range-btn" @click="mapViewRef?.moveRangeToPosition()">
            Mută centrul range-ului la poziție
          </button>
        </section>
        <section v-if="settings.showS14Stats" class="panel-section">
          <h3>Legendă S14 (statistici)</h3>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(34,197,94,0.3);border:1px solid #22c55e"></span>
            <span>La prag (0 POI lipsă)</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(245,158,11,0.3);border:1px solid #f59e0b"></span>
            <span>1 POI lipsă</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(239,68,68,0.3);border:1px solid #ef4444"></span>
            <span>2+ POI lipsă</span>
          </div>
        </section>
        <section class="panel-section">
          <h3>Legendă S17</h3>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(239,68,68,0.35);border:1px solid #ef4444"></span>
            <span>Ocupat (stop/gym activ)</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(34,197,94,0.25);border:1px solid #22c55e"></span>
            <span>Liber</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background:rgba(245,158,11,0.3);border:1px dashed #f59e0b"></span>
            <span>Liber (incert – S14 trunchiat)</span>
          </div>
          <div class="legend-row">
            <span class="legend-swatch" style="background:transparent;border:1px solid #6b7280"></span>
            <span>Necunoscut (fără date)</span>
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
  background: #fff;
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
  background: #fff;
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
  color: #666;
  font-size: 14px;
}

.panel-section {
  margin-bottom: 16px;
}

.panel-section h3 {
  font-size: 13px;
  text-transform: uppercase;
  color: #888;
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
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #f9fafb;
  font-size: 13px;
  cursor: pointer;
}

.field-range-btn:hover {
  background: #f3f4f6;
}

/* --- Dark theme (follows system) --- */
@media (prefers-color-scheme: dark) {
  body {
    background: #111827;
    color: #e5e7eb;
  }

  .side-panel {
    background: #1f2937;
    box-shadow: -2px 0 8px rgba(0, 0, 0, 0.4);
  }

  .panel-toggle {
    background: #1f2937;
    color: #e5e7eb;
  }

  .panel-section h3 {
    color: #9ca3af;
  }

  .field-range-btn {
    background: #374151;
    border-color: #4b5563;
    color: #e5e7eb;
  }

  .field-range-btn:hover {
    background: #4b5563;
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
