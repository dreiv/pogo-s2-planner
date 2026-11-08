<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, provide, watch } from 'vue'
import { createMap } from '../map/createMap'
import { locateMe } from '../map/locateMe'
import { MAP_CONTEXT_KEY, type MapContext } from '../map/MapContext'
import { S2GridLayer, type CellStyleFn } from '../map/S2GridLayer'
import { PoiLayer } from '../map/PoiLayer'
import { RangeLayer } from '../map/RangeLayer'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { useMarksStore } from '../stores/marks'
import { DEFAULT_CLASSIFY_OPTS, type CellState } from '../core/classify'
import { classifyS17Token } from '../core/cellState'
import { parentToken } from '../core/s2'
import { buildPoiIndex, type PoiIndex } from '../core/poiIndex'
import { showCellPopup } from '../map/cellPopup'
import { MARK_OUTLINE_WEIGHT, MARK_STATUS_DASH } from '../markStyle'
import { CELL_STATE_COLORS, MARK_STATUS_COLORS, GRID_STROKE } from '../theme'
import { GRID_MAX_CELLS } from '../config'

type LeafletMap = ReturnType<typeof createMap>

const settings = useSettingsStore()
const dataset = useDatasetStore()
const marks = useMarksStore()
const containerRef = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let cleanupLocate: (() => void) | null = null
let s14Layer: S2GridLayer | null = null
let s17Layer: S2GridLayer | null = null
let poiLayer: PoiLayer | null = null
let rangeLayer: RangeLayer | null = null
let flushMoveEndRef: (() => void) | null = null

// Cell state is derived per visible S17 token, so empty cells inside a covered S14 cell are "free" too.
let cachedClassifyKey = ''
let stateCache = new Map<string, CellState>()
let s14Coverage = new Map<string, boolean>() // S14 token -> truncated
let cachedPoiIndex: PoiIndex | null = null

function getPoiIndex(): PoiIndex {
  if (!cachedPoiIndex) {
    cachedPoiIndex = buildPoiIndex(dataset.pois)
  }
  return cachedPoiIndex
}

function ensureClassifyCache(): void {
  const key = `${dataset.revision}`
  if (key === cachedClassifyKey) return
  s14Coverage = new Map(dataset.cells.map((c) => [c.token, c.truncated]))
  stateCache = new Map()
  cachedClassifyKey = key
}

function cellStateOf(token: string): CellState {
  ensureClassifyCache()
  const hit = stateCache.get(token)
  if (hit) return hit
  const truncated = s14Coverage.get(parentToken(token, 14))
  const state = classifyS17Token(
    getPoiIndex().poisByS17.get(token) ?? [],
    { covered: truncated !== undefined, truncated: truncated ?? false },
    DEFAULT_CLASSIFY_OPTS
  )
  stateCache.set(token, state)
  return state
}

const CELL_COLORS: Record<CellState, { fill: string; opacity: number }> = {
  occupied: { fill: CELL_STATE_COLORS.occupied, opacity: 0.25 },
  free: { fill: CELL_STATE_COLORS.free, opacity: 0 }, // no fill: too noisy
  'free-uncertain': { fill: CELL_STATE_COLORS['free-uncertain'], opacity: 0.2 },
  unknown: { fill: CELL_STATE_COLORS.unknown, opacity: 0 }
}

function makeS17CellStyle(): CellStyleFn {
  const markMap = marks.markByToken
  return (token: string) => {
    const c = CELL_COLORS[cellStateOf(token)]
    const mark = markMap.get(token)
    if (mark) {
      return {
        fillColor: c.opacity > 0 ? c.fill : MARK_STATUS_COLORS[mark.status],
        fillOpacity: c.opacity,
        color: MARK_STATUS_COLORS[mark.status],
        weight: MARK_OUTLINE_WEIGHT,
        dashArray: MARK_STATUS_DASH[mark.status]
      }
    }
    if (c.opacity === 0) return null
    return { fillColor: c.fill, fillOpacity: c.opacity }
  }
}

const emit = defineEmits<{
  cellSelected: [token: string]
}>()

function handleS17CellClick(token: string, lat: number, lng: number): void {
  if (!map) return
  const state = cellStateOf(token)
  const s14 = parentToken(token, 14)
  const cellPois = getPoiIndex().poisByS17.get(token) ?? []

  showCellPopup(map, [lat, lng], {
    s17Token: token,
    s14Token: s14,
    state,
    pois: cellPois.map((p) => ({ id: p.id, title: p.title }))
  })

  emit('cellSelected', token)
}

function syncGridLayers(): void {
  if (!map) return

  if (settings.showS14 && !s14Layer) {
    s14Layer = new S2GridLayer(map, {
      level: 14,
      minZoom: settings.s14MinZoom,
      maxCells: GRID_MAX_CELLS,
      color: GRID_STROKE.s14,
      weight: 2,
      onUpdated: () => poiLayer?.bringToFront()
    })
  } else if (!settings.showS14 && s14Layer) {
    s14Layer.destroy()
    s14Layer = null
  }

  if (settings.showS17 && !s17Layer) {
    s17Layer = new S2GridLayer(map, {
      level: 17,
      minZoom: settings.s17MinZoom,
      maxCells: GRID_MAX_CELLS,
      color: GRID_STROKE.s17,
      weight: 1,
      dashArray: '3 5',
      cellStyle: makeS17CellStyle(),
      onCellClick: handleS17CellClick,
      onUpdated: () => poiLayer?.bringToFront()
    })
  } else if (!settings.showS17 && s17Layer) {
    s17Layer.destroy()
    s17Layer = null
  }

  poiLayer?.bringToFront()
}

let lastPoiRevision = -1

function syncPoiLayer(): void {
  if (!map) return

  if (settings.showPois && !poiLayer) {
    poiLayer = new PoiLayer(map, {
      fullDetailZoom: 16,
      showOther: settings.showOtherPois,
      stopGymOnly: settings.stopGymOnly,
      showImages: settings.showPoiImages
    })
    poiLayer.setPois(dataset.pois)
    lastPoiRevision = dataset.revision
  } else if (!settings.showPois && poiLayer) {
    poiLayer.destroy()
    poiLayer = null
  } else if (poiLayer) {
    poiLayer.setOptions({
      showOther: settings.showOtherPois,
      stopGymOnly: settings.stopGymOnly,
      showImages: settings.showPoiImages
    })
    if (dataset.revision !== lastPoiRevision) {
      poiLayer.setPois(dataset.pois)
      lastPoiRevision = dataset.revision
    }
  }
}

function syncRangeLayer(): void {
  if (!map) return

  if (settings.showRange && !rangeLayer) {
    rangeLayer = new RangeLayer(map, {
      radius: settings.rangeRadius,
      showS17: settings.showS17,
      showS14: settings.showS14
    })
    rangeLayer.onCenterChanged((lat, lng) => {
      settings.setRangeCenter([lat, lng])
    })
    if (settings.rangeCenter) {
      rangeLayer.setCenter(settings.rangeCenter[0], settings.rangeCenter[1])
    }
  } else if (!settings.showRange && rangeLayer) {
    rangeLayer.destroy()
    rangeLayer = null
  } else if (rangeLayer) {
    rangeLayer.setRadius(settings.rangeRadius)
    rangeLayer.setOptions({
      showS17: settings.showS17,
      showS14: settings.showS14
    })
    if (settings.rangeCenter) {
      rangeLayer.setCenter(settings.rangeCenter[0], settings.rangeCenter[1])
    }
  }
}

onMounted(() => {
  if (!containerRef.value) return

  map = createMap(containerRef.value, {
    center: settings.center,
    zoom: settings.zoom
  })

  provide(MAP_CONTEXT_KEY, { map } satisfies MapContext)

  let moveEndTimer: ReturnType<typeof setTimeout> | null = null
  const flushMoveEnd = (): void => {
    if (moveEndTimer !== null) {
      clearTimeout(moveEndTimer)
      moveEndTimer = null
    }
    if (!map) return
    const c = map.getCenter()
    settings.setCenter([c.lat, c.lng])
    settings.setZoom(map.getZoom())
  }
  map.on('moveend', () => {
    if (moveEndTimer !== null) clearTimeout(moveEndTimer)
    moveEndTimer = setTimeout(flushMoveEnd, 400)
  })
  flushMoveEndRef = flushMoveEnd

  syncGridLayers()
  syncPoiLayer()
  syncRangeLayer()
})

watch(
  () => [settings.showS14, settings.showS17, settings.s14MinZoom, settings.s17MinZoom] as const,
  () => {
    if (s14Layer) {
      s14Layer.destroy()
      s14Layer = null
    }
    syncGridLayers()
  }
)

watch(
  () => [settings.showPois, settings.showOtherPois, settings.stopGymOnly, settings.showPoiImages] as const,
  () => syncPoiLayer()
)

watch(
  () => [settings.showRange, settings.rangeRadius, settings.rangeCenter, settings.showS17, settings.showS14] as const,
  () => syncRangeLayer()
)

watch(
  () => dataset.revision,
  () => {
    cachedClassifyKey = ''
    cachedPoiIndex = null
    syncPoiLayer()
    if (s17Layer) {
      s17Layer.setCellStyle(makeS17CellStyle())
    }
    poiLayer?.bringToFront()
  }
)

watch(
  () => marks.revision,
  () => {
    if (s17Layer) {
      s17Layer.setCellStyle(makeS17CellStyle())
    }
  }
)

onBeforeUnmount(() => {
  if (flushMoveEndRef) flushMoveEndRef()
  if (cleanupLocate) cleanupLocate()
  if (s14Layer) { s14Layer.destroy(); s14Layer = null }
  if (s17Layer) { s17Layer.destroy(); s17Layer = null }
  if (poiLayer) { poiLayer.destroy(); poiLayer = null }
  if (rangeLayer) { rangeLayer.destroy(); rangeLayer = null }
  if (map) {
    map.remove()
    map = null
  }
})

const handleLocate = (): void => {
  if (!map) return
  if (cleanupLocate) cleanupLocate()
  cleanupLocate = locateMe(map)
}
</script>

<template>
  <div class="map-wrapper">
    <div ref="containerRef" class="map-container"></div>
    <button class="locate-btn" title="My location" @click="handleLocate">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8" />
        <line x1="12" y1="1" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="23" />
        <line x1="1" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="23" y2="12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-container {
  width: 100%;
  height: 100%;
}

.locate-btn {
  position: absolute;
  bottom: calc(20px + env(safe-area-inset-bottom));
  right: 16px;
  z-index: 1000;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--bg-panel);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
}

.locate-btn:hover {
  background: var(--bg-hover);
}
</style>
