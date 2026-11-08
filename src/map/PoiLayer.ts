import L from 'leaflet'
import type { ParsedPoi } from '../core/wayfarer/parse'
import { poiKind, type PoiKind } from '../core/classify'
import { POI_COLORS } from '../theme'
import { buildPoiPopupContent } from './poiPopup'

export interface PoiLayerOptions {
  /** Minimum zoom to show all POI kinds. Below this, only stop/gym. */
  fullDetailZoom: number
  showOther: boolean
  stopGymOnly: boolean
  showImages: boolean
}

export const DEFAULT_POI_LAYER_OPTS: PoiLayerOptions = {
  fullDetailZoom: 16,
  showOther: true,
  stopGymOnly: false,
  showImages: true
}

const KIND_RADIUS: Record<PoiKind, number> = {
  stop: 6,
  gym: 7,
  powerspot: 5,
  other: 4
}

/** Markers are created for POIs within the viewport padded by this ratio (smooth short pans). */
const VIEWPORT_PAD = 0.5

function kindForZoom(kind: PoiKind, zoom: number, opts: PoiLayerOptions): boolean {
  if (opts.stopGymOnly && kind !== 'stop' && kind !== 'gym') return false
  if (!opts.showOther && kind === 'other') return false
  if (zoom < opts.fullDetailZoom && kind !== 'stop' && kind !== 'gym') return false
  return true
}

interface PoiEntry {
  poi: ParsedPoi
  kind: PoiKind
  /** True while the marker is on the map. */
  visible: boolean
  /** Created lazily when the POI enters the viewport, dropped when it leaves. */
  marker: L.CircleMarker | null
}

/** Extra hit radius (px) around each marker; larger for touch. */
function hitTolerance(): number {
  const coarse =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches
  return coarse ? 14 : 8
}

const POI_PANE = 'poiPane'

/**
 * POIs are plain records; a circleMarker exists only for POIs that pass the kind/zoom filter AND
 * lie inside the padded viewport. Clicks are handled once on the FeatureGroup (delegated) and the
 * popup is built on demand, so there is no per-marker popup binding or listener.
 */
export class PoiLayer {
  private map: L.Map
  private group: L.FeatureGroup
  private opts: PoiLayerOptions
  private entries: PoiEntry[] = []
  private entryByMarker = new WeakMap<L.Layer, PoiEntry>()
  private renderer: L.Canvas
  /** Read-only counter: incremented each time the POI set is (re)loaded. For tests. */
  rebuildCount = 0

  constructor(map: L.Map, opts: Partial<PoiLayerOptions> = {}) {
    this.map = map
    this.opts = { ...DEFAULT_POI_LAYER_OPTS, ...opts }
    // Dedicated pane above grid polygons + canvas with extra click tolerance:
    // Canvas has no :after, so tolerance is how a marker gets a bigger hit area.
    const pane = map.getPane(POI_PANE) ?? map.createPane(POI_PANE)
    pane.style.zIndex = '450'
    this.renderer = L.canvas({ pane: POI_PANE, tolerance: hitTolerance() })
    this.group = L.featureGroup()
    this.group.addTo(map)
    this.group.on('click', this.handleClick)

    map.on('zoomend', this.handleViewChange)
    map.on('moveend', this.handleViewChange)
  }

  setPois(pois: ParsedPoi[]): void {
    this.rebuildCount++
    this.group.clearLayers()
    this.entries = pois.map((poi) => ({ poi, kind: poiKind(poi), visible: false, marker: null }))
    this.refresh()
  }

  setOptions(opts: Partial<PoiLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.refresh()
  }

  private handleViewChange = (): void => {
    this.refresh()
  }

  private createMarker(entry: PoiEntry): L.CircleMarker {
    const marker = L.circleMarker([entry.poi.lat, entry.poi.lng], {
      radius: KIND_RADIUS[entry.kind],
      color: '#ffffff',
      weight: 2,
      fillColor: POI_COLORS[entry.kind],
      fillOpacity: 1,
      opacity: 1,
      // Keep a marker click from also reaching the map (cell selection, range center).
      bubblingMouseEvents: false,
      renderer: this.renderer
    })
    this.entryByMarker.set(marker, entry)
    return marker
  }

  private handleClick = (e: L.LeafletEvent): void => {
    const source = (e as L.LeafletEvent & { layer?: L.Layer }).layer ?? e.propagatedFrom
    const entry = source ? this.entryByMarker.get(source as L.Layer) : undefined
    if (!entry) return
    const popup = L.popup({
      maxWidth: Math.min(280, (typeof window !== 'undefined' ? window.innerWidth : 360) - 72)
    })
    const content = buildPoiPopupContent(entry.poi, entry.kind, {
      showImages: this.opts.showImages,
      onResize: () => popup.update()
    })
    popup.setLatLng([entry.poi.lat, entry.poi.lng]).setContent(content).openOn(this.map)
  }

  /** Reconciles markers with the current zoom, filters and viewport; only the delta is touched. */
  private refresh(): void {
    const zoom = this.map.getZoom()
    const b = this.map.getBounds().pad(VIEWPORT_PAD)
    const south = b.getSouth()
    const north = b.getNorth()
    const west = b.getWest()
    const east = b.getEast()

    for (const entry of this.entries) {
      const { lat, lng } = entry.poi
      const want =
        kindForZoom(entry.kind, zoom, this.opts) &&
        lat >= south &&
        lat <= north &&
        lng >= west &&
        lng <= east
      if (want === entry.visible) continue
      entry.visible = want
      if (want) {
        entry.marker ??= this.createMarker(entry)
        this.group.addLayer(entry.marker)
      } else if (entry.marker) {
        // Hidden markers are removed (an invisible canvas marker still catches clicks).
        this.group.removeLayer(entry.marker)
        this.entryByMarker.delete(entry.marker)
        entry.marker = null
      }
    }
  }

  destroy(): void {
    this.map.off('zoomend', this.handleViewChange)
    this.map.off('moveend', this.handleViewChange)
    this.group.off('click', this.handleClick)
    this.group.remove()
    this.renderer.remove()
    this.entries = []
  }
}
