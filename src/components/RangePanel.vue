<script setup lang="ts">
import { computed } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { poisWithin, cellsIntersectingCircle } from '../core/geo'
import { poiKind } from '../core/classify'

const settings = useSettingsStore()
const dataset = useDatasetStore()

const rangePois = computed(() => {
  if (!settings.rangeCenter) return []
  return poisWithin(
    settings.rangeCenter[0],
    settings.rangeCenter[1],
    settings.rangeRadius,
    dataset.pois
  )
})

const stopGymPois = computed(() =>
  rangePois.value.filter((p) => {
    const kind = poiKind(p.poi)
    return kind === 'stop' || kind === 'gym'
  })
)

const s17Cells = computed(() => {
  if (!settings.rangeCenter) return []
  return cellsIntersectingCircle(
    settings.rangeCenter[0],
    settings.rangeCenter[1],
    settings.rangeRadius,
    17
  )
})

const s14Cells = computed(() => {
  if (!settings.rangeCenter) return []
  return cellsIntersectingCircle(
    settings.rangeCenter[0],
    settings.rangeCenter[1],
    settings.rangeRadius,
    14
  )
})

function useMyLocation(): void {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      settings.setRangeCenter([pos.coords.latitude, pos.coords.longitude])
    },
    () => {
      // ignore
    }
  )
}
</script>

<template>
  <section class="panel-section">
    <h3>Range</h3>
    <label class="toggle-row">
      <input type="checkbox" :checked="settings.showRange" @change="settings.toggleShowRange()" />
      <span>Instrument de range</span>
    </label>

    <template v-if="settings.showRange">
      <div class="range-controls">
        <label class="range-label">
          Rază: <strong>{{ settings.rangeRadius }} m</strong>
        </label>
        <input
type="range" :min="20" :max="500" :step="10" :value="settings.rangeRadius" class="range-slider"
          @input="settings.setRangeRadius(Number(($event.target as HTMLInputElement).value))" />
        <div class="range-presets">
          <button
v-for="p in [80, 250, 500]" :key="p" class="preset-btn"
            :class="{ active: settings.rangeRadius === p }" @click="settings.setRangeRadius(p)">
            {{ p }} m
          </button>
        </div>
      </div>

      <button class="range-btn" @click="useMyLocation">
        Folosește locația mea
      </button>

      <p v-if="!settings.rangeCenter" class="range-hint">
        Click pe hartă pentru a seta centrul.
      </p>

      <template v-else>
        <div class="range-stats">
          <p><strong>{{ stopGymPois.length }}</strong> stop/gym în rază</p>
          <p><strong>{{ s17Cells.length }}</strong> celule S17 atinse</p>
          <p><strong>{{ s14Cells.length }}</strong> celule S14 atinse</p>
        </div>

        <ul v-if="stopGymPois.length > 0" class="range-poi-list">
          <li v-for="item in stopGymPois" :key="item.poi.id" class="range-poi-item">
            <span class="poi-kind" :class="poiKind(item.poi)">{{ poiKind(item.poi) }}</span>
            <span class="poi-name">{{ item.poi.title || item.poi.id }}</span>
            <span class="poi-dist">{{ Math.round(item.distance) }} m</span>
          </li>
        </ul>
      </template>

      <label class="toggle-row">
        <input type="checkbox" :checked="settings.showRangeRings" @change="settings.toggleShowRangeRings()" />
        <span>Inele 80 m (stop/gym)</span>
      </label>
    </template>
  </section>
</template>

<style scoped>
.range-controls {
  margin: 8px 0;
}

.range-label {
  font-size: 13px;
  display: block;
  margin-bottom: 4px;
}

.range-slider {
  width: 100%;
  margin: 4px 0;
}

.range-presets {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.preset-btn {
  flex: 1;
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}

.preset-btn.active {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.range-btn {
  width: 100%;
  padding: 6px;
  margin: 8px 0;
  font-size: 13px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f9fafb;
  cursor: pointer;
}

.range-btn:hover {
  background: #f3f4f6;
}

.range-hint {
  font-size: 12px;
  color: #888;
  margin: 4px 0;
}

.range-stats {
  font-size: 13px;
  margin: 8px 0;
}

.range-stats p {
  margin: 2px 0;
}

.range-poi-list {
  list-style: none;
  padding: 0;
  margin: 8px 0;
  max-height: 200px;
  overflow-y: auto;
}

.range-poi-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 0;
  border-bottom: 1px solid #eee;
}

.poi-kind {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  color: #fff;
  flex-shrink: 0;
}

.poi-kind.stop {
  background: #3b82f6;
}

.poi-kind.gym {
  background: #ef4444;
}

.poi-kind.powerspot {
  background: #f59e0b;
}

.poi-kind.other {
  background: #9ca3af;
}

.poi-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-dist {
  color: #666;
  flex-shrink: 0;
}
</style>
