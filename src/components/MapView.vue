<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, provide, watch } from 'vue'
import { createMap } from '../map/createMap'
import { locateMe } from '../map/locateMe'
import { startFieldMode } from '../map/fieldMode'
import { MAP_CONTEXT_KEY, type MapContext } from '../map/MapContext'
import { S2GridLayer, type CellStyleFn } from '../map/S2GridLayer'
import { PoiLayer } from '../map/PoiLayer'
import { RangeLayer } from '../map/RangeLayer'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { useMarksStore } from '../stores/marks'
import { classifyS17, DEFAULT_CLASSIFY_OPTS, type CellState } from '../core/classify'
import { parentToken, cellCenter } from '../core/s2'
import { buildPoiIndex, type PoiIndex } from '../core/poiIndex'
import { showCellPopup } from '../map/cellPopup'
import { showS14StatsPopup } from '../map/s14Popup'
import { computeS14Stats, DEFAULT_THRESHOLDS, type S14Stats } from '../core/stats'
import type { MarkStatus } from '../data/db'
import {
  CELL_STATE_COLORS,
  MARK_STATUS_COLORS,
  S14_STATS_COLORS,
  GRID_STROKE
} from '../theme'
import { GRID_MAX_CELLS } from '../config'

type LeafletMap = ReturnType<typeof createMap>

const settings = useSettingsStore()
const dataset = useDatasetStore()
const marks = useMarksStore()
const containerRef = ref<HTMLElement | null>(null)
let map: LeafletMap | null = null
let cleanupLocate: (() => void) | null = null
let cleanupField: (() => void) | null = null
let lastFieldPosition: [number, number] | null = null
let s14Layer: S2GridLayer | null = null
let s17Layer: S2GridLayer | null = null
let poiLayer: PoiLayer | null = null
let rangeLayer: RangeLayer | null = null
let flushMoveEndRef: (() => void) | null = null

// --- Cell classification (memoized) ---
let cachedClassifyKey = ''
let cachedCellStates: Map<string, CellState> = new Map()
let cachedPoiIndex: PoiIndex | null = null

function getPoiIndex(): PoiIndex {
  if (!cachedPoiIndex) {
    cachedPoiIndex = buildPoiIndex(dataset.pois)
  }
  return cachedPoiIndex
}

function getCellStates(): Map<string, CellState> {
  const key = `${dataset.revision}:${settings.powerspotCounts}`
  if (key === cachedClassifyKey) return cachedCellStates

  const coveredS14 = new Set<string>()
  const truncatedS14 = new Set<string>()
  for (const cell of dataset.cells) {
    coveredS14.add(cell.token)
    if (cell.truncated) truncatedS14.add(cell.token)
  }

  const index = getPoiIndex()
  cachedCellStates = classifyS17(
    dataset.pois,
    coveredS14,
    truncatedS14,
    { ...DEFAULT_CLASSIFY_OPTS, powerspotCounts: settings.powerspotCounts },
    index
  )

  cachedClassifyKey = key
  return cachedCellStates
}

// --- S14 stats (memoized) ---
let cachedStatsKey = ''
let cachedS14Stats: Map<string, S14Stats> = new Map()

function getS14Stats(): Map<string, S14Stats> {
  const key = `${dataset.revision}:${settings.powerspotCounts}:${marks.revision}`
  if (key === cachedStatsKey) return cachedS14Stats
  cachedS14Stats = computeS14Stats(
    dataset.pois,
    dataset.cells,
    {
      thresholds: DEFAULT_THRESHOLDS,
      classifyOpts: { ...DEFAULT_CLASSIFY_OPTS, powerspotCounts: settings.powerspotCounts },
      pendingTokens: marks.pendingTokens
    },
    getPoiIndex()
  )
  cachedStatsKey = key
  return cachedS14Stats
}

/** Color S14 by distance to next threshold: 0=green, 1=yellow, 2+=red. */
function makeS14StatsStyle(): CellStyleFn {
  const stats = getS14Stats()
  return (token: string) => {
    const s = stats.get(token)
    if (!s) return null
    const dist = s.poiToNextThreshold
    if (dist === 0) return { fillColor: S14_STATS_COLORS.atThreshold, fillOpacity: 0.2 }
    if (dist === 1) return { fillColor: S14_STATS_COLORS.nearThreshold, fillOpacity: 0.25 }
    return { fillColor: S14_STATS_COLORS.farThreshold, fillOpacity: 0.2 }
  }
}

function handleS14CellClick(token: string, lat: number, lng: number): void {
  if (!map) return
  const stats = getS14Stats()
  const s = stats.get(token)
  if (!s) return
  showS14StatsPopup(map, [lat, lng], s)
}

const CELL_COLORS: Record<CellState, { fill: string; opacity: number }> = {
  occupied: { fill: CELL_STATE_COLORS.occupied, opacity: 0.25 },
  free: { fill: CELL_STATE_COLORS.free, opacity: 0.15 },
  'free-uncertain': { fill: CELL_STATE_COLORS['free-uncertain'], opacity: 0.2 },
  unknown: { fill: CELL_STATE_COLORS.unknown, opacity: 0 }
}

const MARK_COLORS: Record<MarkStatus, string> = {
  planificat: MARK_STATUS_COLORS.planificat,
  propus: MARK_STATUS_COLORS.propus,
  'in-review': MARK_STATUS_COLORS['in-review'],
  respins: MARK_STATUS_COLORS.respins,
  aprobat: MARK_STATUS_COLORS.aprobat
}

function makeS17CellStyle(): CellStyleFn {
  const states = getCellStates()
  const markMap = marks.markByToken
  return (token: string) => {
    // Marked cells take priority
    const mark = markMap.get(token)
    if (mark) {
      return {
        fillColor: MARK_COLORS[mark.status],
        fillOpacity: 0.4,
        color: MARK_COLORS[mark.status],
        weight: 2,
        dashArray: '4 2'
      }
    }
    const state = states.get(token)
    if (!state) return null
    const c = CELL_COLORS[state]
    if (c.opacity === 0) return null
    return { fillColor: c.fill, fillOpacity: c.opacity }
  }
}

const emit = defineEmits<{
  cellSelected: [token: string]
}>()

function handleS17CellClick(token: string, lat: number, lng: number): void {
  if (!map) return
  const states = getCellStates()
  const state = states.get(token) ?? 'unknown'
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

  // S14
  if (settings.showS14 && !s14Layer) {
    s14Layer = new S2GridLayer(map, {
      level: 14,
      minZoom: settings.s14MinZoom,
      maxCells: GRID_MAX_CELLS,
      color: GRID_STROKE.s14,
      weight: 2,
      cellStyle: settings.showS14Stats ? makeS14StatsStyle() : undefined,
      onCellClick: handleS14CellClick,
      onUpdated: () => poiLayer?.bringToFront()
    })
  } else if (!settings.showS14 && s14Layer) {
    s14Layer.destroy()
    s14Layer = null
  }

  // S17
  if (settings.showS17 && !s17Layer) {
    s17Layer = new S2GridLayer(map, {
      level: 17,
      minZoom: settings.s17MinZoom,
      maxCells: GRID_MAX_CELLS,
      color: GRID_STROKE.s17,
      weight: 1,
      cellStyle: makeS17CellStyle(),
      onCellClick: handleS17CellClick,
      onUpdated: () => poiLayer?.bringToFront()
    })
  } else if (!settings.showS17 && s17Layer) {
    s17Layer.destroy()
    s17Layer = null
  }

  // Ensure POI markers are on top of grid polygons
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
    // Only rebuild markers when the dataset actually changed
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

  // Provide map context for child layers
  provide(MAP_CONTEXT_KEY, { map } satisfies MapContext)

  // Persist center/zoom on move (debounced to avoid writing on every pan step)
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
  // Expose flush so onBeforeUnmount can flush pending writes
  flushMoveEndRef = flushMoveEnd

  // Initial grid layers + POI layer + range layer
  syncGridLayers()
  syncPoiLayer()
  syncRangeLayer()
})

// React to grid toggle changes
watch(
  () => [settings.showS14, settings.showS17, settings.s14MinZoom, settings.s17MinZoom, settings.showS14Stats] as const,
  () => {
    // Rebuild S14 layer when stats mode changes
    if (s14Layer) {
      s14Layer.destroy()
      s14Layer = null
    }
    syncGridLayers()
  }
)

// React to POI display settings
watch(
  () => [settings.showPois, settings.showOtherPois, settings.stopGymOnly, settings.showPoiImages] as const,
  () => syncPoiLayer()
)

// React to range settings
watch(
  () => [settings.showRange, settings.rangeRadius, settings.rangeCenter, settings.showS17, settings.showS14] as const,
  () => syncRangeLayer()
)

// React to dataset changes (import/clear)
watch(
  () => dataset.revision,
  () => {
    cachedClassifyKey = '' // invalidate memo
    cachedStatsKey = '' // invalidate stats memo
    cachedPoiIndex = null // invalidate POI index
    syncPoiLayer()
    // Update grid styles in-place (no destroy/recreate)
    if (s17Layer) {
      s17Layer.setCellStyle(makeS17CellStyle())
    }
    if (s14Layer && settings.showS14Stats) {
      s14Layer.setCellStyle(makeS14StatsStyle())
    }
    // Ensure POI markers are on top
    poiLayer?.bringToFront()
  }
)

// React to marks changes
watch(
  () => marks.revision,
  () => {
    cachedStatsKey = '' // invalidate stats memo
    // Update S17 styles in-place (marks change colors)
    if (s17Layer) {
      s17Layer.setCellStyle(makeS17CellStyle())
    }
    if (s14Layer && settings.showS14Stats) {
      s14Layer.setCellStyle(makeS14StatsStyle())
    }
  }
)

// React to field mode toggle
watch(
  () => settings.fieldMode,
  (on) => {
    const m = map
    if (!m) return
    if (on) {
      if (cleanupField) cleanupField()
      cleanupField = startFieldMode(m, {
        onPosition: (lat, lng) => {
          lastFieldPosition = [lat, lng]
          if (settings.followPosition) {
            m.panTo([lat, lng])
          }
        },
        onStopped: (reason) => {
          settings.setFieldMode(false)
          console.warn('Field mode stopped:', reason)
        }
      })
    } else {
      if (cleanupField) {
        cleanupField()
        cleanupField = null
      }
    }
  }
)

onBeforeUnmount(() => {
  // Flush pending center/zoom writes before tearing down
  if (flushMoveEndRef) flushMoveEndRef()
  if (cleanupLocate) cleanupLocate()
  if (cleanupField) cleanupField()
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

/** Zoom the map to a specific S14 cell. */
function zoomToS14(token: string): void {
  if (!map) return
  const center = cellCenter(token)
  map.setView([center[0], center[1]], Math.max(map.getZoom(), 15))
}

/** Move the range center to the last known field position. */
function moveRangeToPosition(): void {
  if (!lastFieldPosition) return
  settings.setRangeCenter(lastFieldPosition)
}

defineExpose({ zoomToS14, moveRangeToPosition })
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
  bottom: 20px;
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
