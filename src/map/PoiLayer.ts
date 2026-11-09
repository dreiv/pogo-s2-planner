import L from 'leaflet'
import type { ParsedPoi } from '../core/wayfarer/parse'
import { poiKind, type PoiKind } from '../core/classify'
import { POI_COLORS } from '../theme'
import {
  poiMarkerScale,
  scaledMarkerRadius,
  thinCellPx,
  thinPois,
  toWorld,
  type ThinCandidate
} from '../core/poiThinning'
import { buildPoiPopupContent } from './poiPopup'

export interface PoiLayerOptions {
  /** Minimum zoom to show all POI kinds. Below this, only stop/gym. */
  fullDetailZoom: number
  showGyms: boolean
  showStops: boolean
  showPowerSpots: boolean
  /** Non-game POIs (only drawn from fullDetailZoom). */
  showOther: boolean
  /** Below fullDetailZoom, draw one POI per screen square (gym first) and smaller dots. */
  thinOut: boolean
  /** Called when "some POIs are currently hidden by thinning" flips. */
  onThinChange?: (thinned: boolean) => void
}

export const DEFAULT_POI_LAYER_OPTS: PoiLayerOptions = {
  fullDetailZoom: 16,
  showGyms: true,
  showStops: true,
  showPowerSpots: true,
  showOther: true,
  thinOut: false
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
  if (kind === 'gym' && !opts.showGyms) return false
  if (kind === 'stop' && !opts.showStops) return false
  if (kind === 'powerspot' && !opts.showPowerSpots) return false
  if (kind === 'other' && !opts.showOther) return false
  if (zoom < opts.fullDetailZoom && kind !== 'stop' && kind !== 'gym') return false
  return true
}

interface PoiEntry extends ThinCandidate {
  poi: ParsedPoi
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
  /** POIs kept by thinning at `thinZoom`; null = not computed (recomputed lazily on refresh). */
  private thinKept: Set<PoiEntry> | null = null
  private thinZoom = NaN
  private thinned = false
  /** Radius scale the live markers currently have. */
  private markerScale = 1
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
    this.thinKept = null
    this.entries = pois.map((poi) => ({
      poi,
      id: poi.id,
      kind: poiKind(poi),
      ...toWorld(poi.lat, poi.lng),
      visible: false,
      marker: null
    }))
    this.refresh()
  }

  setOptions(opts: Partial<PoiLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.thinKept = null
    this.refresh()
  }

  private handleViewChange = (): void => {
    this.refresh()
  }

  private createMarker(entry: PoiEntry): L.CircleMarker {
    const marker = L.circleMarker([entry.poi.lat, entry.poi.lng], {
      radius: scaledMarkerRadius(KIND_RADIUS[entry.kind], this.markerScale),
      color: '#ffffff',
      weight: this.markerScale >= 0.85 ? 2 : 1,
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

    const kept = this.thinnedSet(zoom)
    this.applyMarkerScale(zoom)

    for (const entry of this.entries) {
      const { lat, lng } = entry.poi
      const want =
        kindForZoom(entry.kind, zoom, this.opts) &&
        (kept === null || kept.has(entry)) &&
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

  /**
   * POIs that survive thinning at this zoom, or null when nothing is thinned. Depends only on the
   * integer zoom and the filters (not on the viewport), so panning never reshuffles the dots and
   * the O(n) pass runs once per zoom level, not on every move.
   */
  private thinnedSet(zoom: number): Set<PoiEntry> | null {
    const cellPx = this.opts.thinOut ? thinCellPx(zoom, this.opts.fullDetailZoom) : 0
    if (cellPx <= 0) {
      this.thinKept = null
      this.setThinned(false)
      return null
    }
    const level = Math.floor(zoom)
    if (this.thinKept === null || this.thinZoom !== level) {
      const candidates = this.entries.filter((e) => kindForZoom(e.kind, zoom, this.opts))
      this.thinKept = thinPois(candidates, zoom, cellPx)
      this.thinZoom = level
      this.setThinned(this.thinKept.size < candidates.length)
    }
    return this.thinKept
  }

  private setThinned(next: boolean): void {
    if (next === this.thinned) return
    this.thinned = next
    this.opts.onThinChange?.(next)
  }

  /** Resizes the live markers when the zoom crosses into a different dot size. */
  private applyMarkerScale(zoom: number): void {
    const scale = poiMarkerScale(zoom, this.opts.fullDetailZoom)
    if (scale === this.markerScale) return
    this.markerScale = scale
    for (const entry of this.entries) {
      entry.marker?.setRadius(scaledMarkerRadius(KIND_RADIUS[entry.kind], scale))
      entry.marker?.setStyle({ weight: scale >= 0.85 ? 2 : 1 })
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
