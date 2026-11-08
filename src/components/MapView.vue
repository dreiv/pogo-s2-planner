<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { createMap } from '../map/createMap'
import { locateMe } from '../map/locateMe'
import { S2GridLayer, type CellStyleFn } from '../map/S2GridLayer'
import { PoiLayer } from '../map/PoiLayer'
import { RangeLayer } from '../map/RangeLayer'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { useMarksStore } from '../stores/marks'
import type { CellState } from '../core/classify'
import { parentToken } from '../core/s2'
import { showCellPopup } from '../map/cellPopup'
import { MARK_OUTLINE_WEIGHT, MARK_STATUS_DASH } from '../markStyle'
import { CELL_FILL_OPACITY, CELL_STATE_COLORS, MARK_STATUS_COLORS, GRID_STROKE } from '../theme'
import { GRID_MAX_CELLS, POI_FULL_DETAIL_ZOOM, POI_HINT_MIN_ZOOM } from '../config'
import { isCellStateVisible } from '../core/cellVisibility'

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

// Why a grid is currently hidden; one live region instead of one overlay per layer.
const gridHints = reactive<{ s14: string | null; s17: string | null }>({ s14: null, s17: null })
const currentZoom = ref(settings.zoom)

// Power Spots and non-game POIs only appear from POI_FULL_DETAIL_ZOOM: say so when the person is
// close to it, instead of leaving them wondering where the other POIs are.
const poiHint = computed<string | null>(() =>
  settings.showPois &&
  currentZoom.value >= POI_HINT_MIN_ZOOM &&
  currentZoom.value < POI_FULL_DETAIL_ZOOM
    ? `Zoom in to ${POI_FULL_DETAIL_ZOOM}+ to see Power Spots and other POIs`
    : null
)

// True while the POI layer is hiding some stops/gyms to keep the zoomed-out map readable.
const poisThinned = ref(false)
const thinHint = computed<string | null>(() =>
  settings.showPois && poisThinned.value ? 'Showing a sample of stops, zoom in for all' : null
)

const gridHint = computed(() =>
  [gridHints.s14, gridHints.s17, thinHint.value, poiHint.value].filter(Boolean).join(' · ')
)

const CELL_COLORS: Record<CellState, { fill: string; opacity: number }> = {
  occupied: { fill: CELL_STATE_COLORS.occupied, opacity: CELL_FILL_OPACITY.occupied },
  free: { fill: CELL_STATE_COLORS.free, opacity: CELL_FILL_OPACITY.free },
  'free-uncertain': {
    fill: CELL_STATE_COLORS['free-uncertain'],
    opacity: CELL_FILL_OPACITY['free-uncertain']
  },
  unknown: { fill: CELL_STATE_COLORS.unknown, opacity: CELL_FILL_OPACITY.unknown }
}

/**
 * Coverage is per S14 cell, so "no data" is drawn on the S14 grid: every S14 cell that was not
 * imported gets the gray tint, visible from the S14 minimum zoom (the S17 grid appears much later).
 */
function makeS14CellStyle(): CellStyleFn {
  const covered = new Set(dataset.cells.map((c) => c.token))
  return (token: string) =>
    covered.has(token) || !settings.showCellUnknown
      ? null
      : { fillColor: CELL_COLORS.unknown.fill, fillOpacity: CELL_COLORS.unknown.opacity }
}

function makeS17CellStyle(): CellStyleFn {
  const markMap = marks.markByToken
  // The resolver is memoized per dataset revision and shared with the side panel.
  const stateOf = dataset.cellStateResolver
  return (token: string) => {
    const state = stateOf(token)
    const c = CELL_COLORS[state]
    // A state switched off in the legend is drawn untinted (opacity 0), like the old "free".
    // "No data" is already tinted by the S14 grid underneath, so S17 skips it there (no double tint).
    const s14TintsNoData = settings.showS14 && settings.s14MinZoom <= settings.s17MinZoom
    const hidden = !isCellStateVisible(state, settings) || (state === 'unknown' && s14TintsNoData)
    const opacity = hidden ? 0 : c.opacity
    const mark = markMap.get(token)
    if (mark && !settings.hiddenMarkStatuses.includes(mark.status)) {
      return {
        fillColor: opacity > 0 ? c.fill : MARK_STATUS_COLORS[mark.status],
        fillOpacity: opacity,
        color: MARK_STATUS_COLORS[mark.status],
        weight: MARK_OUTLINE_WEIGHT,
        dashArray: MARK_STATUS_DASH[mark.status]
      }
    }
    if (opacity === 0) return null
    return { fillColor: c.fill, fillOpacity: opacity }
  }
}

const emit = defineEmits<{
  cellSelected: [token: string]
}>()

function handleS17CellClick(token: string, lat: number, lng: number): void {
  if (!map) return
  const state = dataset.cellStateResolver(token)
  const s14 = parentToken(token, 14)
  const cellPois = dataset.poiIndex.poisByS17.get(token) ?? []
  const s14Cell = dataset.cells.find((c) => c.token === s14)

  showCellPopup(map, [lat, lng], {
    s17Token: token,
    s14Token: s14,
    state,
    s14PoiCount: s14Cell ? s14Cell.count : null,
    lat,
    lng,
    pois: cellPois.map((p) => ({ id: p.id, title: p.title }))
  })

  emit('cellSelected', token)
}

function destroyGridLayers(): void {
  if (s14Layer) {
    s14Layer.destroy()
    s14Layer = null
  }
  if (s17Layer) {
    s17Layer.destroy()
    s17Layer = null
  }
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
      cellStyle: makeS14CellStyle(),
      onHint: (message) => {
        gridHints.s14 = message
      }
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
      onHint: (message) => {
        gridHints.s17 = message
      }
    })
  } else if (!settings.showS17 && s17Layer) {
    s17Layer.destroy()
    s17Layer = null
  }
}

let lastPoiRevision = -1

function syncPoiLayer(): void {
  if (!map) return

  if (settings.showPois && !poiLayer) {
    poiLayer = new PoiLayer(map, {
      fullDetailZoom: POI_FULL_DETAIL_ZOOM,
      showGyms: settings.showGyms,
      showStops: settings.showStops,
      showOther: settings.showOtherPois,
      thinOut: true,
      onThinChange: (thinned) => {
        poisThinned.value = thinned
      }
    })
    poiLayer.setPois(dataset.pois)
    lastPoiRevision = dataset.revision
  } else if (!settings.showPois && poiLayer) {
    poiLayer.destroy()
    poiLayer = null
    poisThinned.value = false
  } else if (poiLayer) {
    poiLayer.setOptions({
      showGyms: settings.showGyms,
      showStops: settings.showStops,
      showOther: settings.showOtherPois
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
  } else if (!settings.showRange && rangeLayer) {
    rangeLayer.destroy()
    rangeLayer = null
  }

  // A single call per change: radius, toggles and center are applied together.
  rangeLayer?.apply({
    radius: settings.rangeRadius,
    showS17: settings.showS17,
    showS14: settings.showS14,
    center: settings.rangeCenter
  })
}

onMounted(() => {
  if (!containerRef.value) return

  map = createMap(containerRef.value, {
    center: settings.center,
    zoom: settings.zoom
  })

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

  currentZoom.value = map.getZoom()
  map.on('zoomend', () => {
    if (map) currentZoom.value = map.getZoom()
  })

  syncGridLayers()
  syncPoiLayer()
  syncRangeLayer()
})

// Layer options (min zoom) are fixed at construction, so both grids are rebuilt on any change.
watch(
  () => [settings.showS14, settings.showS17, settings.s14MinZoom, settings.s17MinZoom] as const,
  () => {
    destroyGridLayers()
    syncGridLayers()
  }
)

watch(
  () => [settings.showPois, settings.showGyms, settings.showStops, settings.showOtherPois] as const,
  () => syncPoiLayer()
)

watch(
  () =>
    [
      settings.showRange,
      settings.rangeRadius,
      settings.rangeCenter,
      settings.showS17,
      settings.showS14
    ] as const,
  () => syncRangeLayer()
)

watch(
  () => dataset.revision,
  () => {
    syncPoiLayer()
    s14Layer?.setCellStyle(makeS14CellStyle())
    s17Layer?.setCellStyle(makeS17CellStyle())
  }
)

// Cell-state and mark-status toggles only restyle existing polygons; no layer is rebuilt.
watch(
  () =>
    [
      settings.showCellOccupied,
      settings.showCellUncertain,
      settings.showCellFree,
      settings.showCellUnknown,
      settings.hiddenMarkStatuses.join(',')
    ] as const,
  () => {
    s14Layer?.setCellStyle(makeS14CellStyle())
    s17Layer?.setCellStyle(makeS17CellStyle())
  }
)

watch(
  () => marks.revision,
  () => {
    s17Layer?.setCellStyle(makeS17CellStyle())
  }
)

onBeforeUnmount(() => {
  if (flushMoveEndRef) flushMoveEndRef()
  if (cleanupLocate) cleanupLocate()
  destroyGridLayers()
  if (poiLayer) {
    poiLayer.destroy()
    poiLayer = null
  }
  if (rangeLayer) {
    rangeLayer.destroy()
    rangeLayer = null
  }
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
    <div v-if="gridHint" class="grid-hint" role="status" aria-live="polite">{{ gridHint }}</div>
    <button
      type="button"
      class="locate-btn"
      title="My location"
      aria-label="Show my location"
      @click="handleLocate"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
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

.grid-hint {
  position: absolute;
  top: calc(12px + env(safe-area-inset-top));
  left: 50%;
  z-index: 1001;
  max-width: calc(100% - 120px);
  padding: 4px 10px;
  transform: translateX(-50%);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  text-align: center;
  pointer-events: none;
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
