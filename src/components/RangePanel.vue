<script setup lang="ts">
import { computed, useId } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import InfoTip from './InfoTip.vue'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { poisWithin, cellsIntersectingCircle } from '../core/geo'
import { poiKind } from '../core/classify'
import '../ui.css'

const settings = useSettingsStore()
const dataset = useDatasetStore()
const sliderId = useId()

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
    () => undefined
  )
}
</script>

<template>
  <CollapsibleSection id="range" title="Range">
    <template #tip><InfoTip term="rangeTool" /></template>

    <button
      type="button"
      class="ui-btn ui-btn--block"
      :class="{ 'ui-btn--pressed': settings.showRange }"
      :aria-pressed="settings.showRange"
      @click="settings.toggleShowRange()"
    >
      <span aria-hidden="true">{{ settings.showRange ? '✓' : '○' }}</span>
      Range tool
    </button>

    <template v-if="settings.showRange">
      <p class="hint">
        {{
          settings.rangeCenter
            ? 'Click the map to move the center.'
            : 'Click the map to place the center of the circle.'
        }}
      </p>

      <div class="range-controls">
        <label class="range-label" :for="sliderId">
          Radius: <strong>{{ settings.rangeRadius }} m</strong>
        </label>
        <input
          :id="sliderId"
          type="range"
          :min="20"
          :max="500"
          :step="10"
          :value="settings.rangeRadius"
          :aria-valuetext="`${settings.rangeRadius} meters`"
          class="range-slider"
          @input="settings.setRangeRadius(Number(($event.target as HTMLInputElement).value))"
        />
        <div class="range-presets">
          <button
            v-for="p in [80, 250, 500]"
            :key="p"
            type="button"
            class="ui-btn preset-btn"
            :class="{ 'ui-btn--pressed': settings.rangeRadius === p }"
            :aria-pressed="settings.rangeRadius === p"
            @click="settings.setRangeRadius(p)"
          >
            {{ p }} m
          </button>
        </div>
      </div>

      <button type="button" class="ui-btn ui-btn--block range-btn" @click="useMyLocation">
        Use my location as the center
      </button>

      <template v-if="settings.rangeCenter">
        <div class="range-stats" aria-live="polite">
          <p><strong>{{ stopGymPois.length }}</strong> stops and gyms in range</p>
          <p><strong>{{ s17Cells.length }}</strong> S17 cells touched</p>
          <p><strong>{{ s14Cells.length }}</strong> S14 cells touched</p>
        </div>

        <ul v-if="stopGymPois.length > 0" class="range-poi-list">
          <li v-for="item in stopGymPois" :key="item.poi.id" class="range-poi-item">
            <span class="poi-kind" :class="poiKind(item.poi)">{{ poiKind(item.poi) }}</span>
            <span class="poi-name">{{ item.poi.title || item.poi.id }}</span>
            <span class="poi-dist">{{ Math.round(item.distance) }} m</span>
          </li>
        </ul>
      </template>
    </template>
  </CollapsibleSection>
</template>

<style scoped>
.hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.range-controls {
  margin: 8px 0;
}

.range-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}

.range-slider {
  width: 100%;
  min-height: 24px;
  margin: 4px 0;
}

.range-presets {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.preset-btn {
  flex: 1;
}

.range-btn {
  margin: 8px 0;
}

.range-stats {
  margin: 8px 0;
  font-size: 13px;
}

.range-stats p {
  margin: 2px 0;
}

.range-poi-list {
  max-height: 200px;
  margin: 8px 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.range-poi-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
}

.poi-kind {
  flex-shrink: 0;
  padding: 1px 4px;
  border-radius: 3px;
  color: #fff;
  font-size: 10px;
}

.poi-kind.stop {
  background: var(--poi-stop);
}

.poi-kind.gym {
  background: var(--poi-gym);
}

.poi-kind.powerspot {
  background: var(--poi-powerspot);
}

.poi-kind.other {
  background: var(--poi-other);
}

.poi-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-dist {
  flex-shrink: 0;
  color: var(--text-secondary);
}
</style>
