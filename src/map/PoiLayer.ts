/**
 * POI marker layer — draws circle markers on the canvas renderer.
 * Colors/shapes differ per kind. Zoom-based filtering.
 * Popup with title, description, address, kind, status; image loaded lazily.
 */
import L from 'leaflet'
import type { ParsedPoi } from '../core/wayfarer/parse'
import { poiKind, type PoiKind } from '../core/classify'
import { POI_COLORS } from '../theme'
import { buildPoiPopupContent } from './poiPopup'

export interface PoiLayerOptions {
  /** Minimum zoom to show all POI kinds. Below this, only stop/gym. */
  fullDetailZoom: number
  /** Whether to show 'other' kind POIs. */
  showOther: boolean
  /** Whether to show only stop/gym (hide powerspot and other). */
  stopGymOnly: boolean
  /** Whether to show POI photos in popups. */
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

function kindForZoom(kind: PoiKind, zoom: number, opts: PoiLayerOptions): boolean {
  if (opts.stopGymOnly && kind !== 'stop' && kind !== 'gym') return false
  if (!opts.showOther && kind === 'other') return false
  if (zoom < opts.fullDetailZoom && kind !== 'stop' && kind !== 'gym') return false
  return true
}

interface MarkerEntry {
  poi: ParsedPoi
  kind: PoiKind
  marker: L.CircleMarker
  visible: boolean
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

export class PoiLayer {
  private group: L.LayerGroup
  private pois: ParsedPoi[] = []
  private opts: PoiLayerOptions
  private entries = new Map<string, MarkerEntry>()
  private currentZoom = 12
  private renderer: L.Canvas
  /** Read-only counter: incremented each time markers are (re)built. For tests. */
  rebuildCount = 0

  constructor(map: L.Map, opts: Partial<PoiLayerOptions> = {}) {
    this.opts = { ...DEFAULT_POI_LAYER_OPTS, ...opts }
    // Dedicated pane above grid polygons + canvas with extra click tolerance:
    // Canvas has no :after, so tolerance is how a marker gets a bigger hit area.
    const pane = map.getPane(POI_PANE) ?? map.createPane(POI_PANE)
    pane.style.zIndex = '450'
    this.renderer = L.canvas({ pane: POI_PANE, tolerance: hitTolerance() })
    this.group = L.layerGroup()
    this.group.addTo(map)
    this.currentZoom = map.getZoom()

    map.on('zoomend', () => {
      this.currentZoom = map.getZoom()
      this.refreshVisibility()
    })
  }

  setPois(pois: ParsedPoi[]): void {
    this.pois = pois
    this.rebuild()
  }

  /**
   * Bring all markers to the front of the canvas draw order.
   * Needed after S2GridLayer redraws polygons (which appends them on top).
   */
  bringToFront(): void {
    // POI markers live in their own pane (above grid polygons); nothing to reorder.
  }

  setOptions(opts: Partial<PoiLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.refreshVisibility()
  }

  private rebuild(): void {
    this.rebuildCount++
    this.group.clearLayers()
    this.entries.clear()

    for (const poi of this.pois) {
      const kind = poiKind(poi)
      const visible = kindForZoom(kind, this.currentZoom, this.opts)
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: KIND_RADIUS[kind],
        color: '#ffffff',
        weight: 2,
        fillColor: POI_COLORS[kind],
        fillOpacity: 1,
        opacity: 1,
        renderer: this.renderer
      })

      // Lazy popup: build DOM on open, load image only then
      marker.bindPopup(
        () => {
          const el = buildPoiPopupContent(poi, kind, {
            showImages: this.opts.showImages,
            onResize: () => {
              const popup = marker.getPopup()
              if (popup) popup.update()
            }
          })
          return el
        },
        { maxWidth: Math.min(280, (typeof window !== 'undefined' ? window.innerWidth : 360) - 72) }
      )

      this.entries.set(poi.id, { poi, kind, marker, visible })
      if (visible) this.group.addLayer(marker)
    }
  }

  private refreshVisibility(): void {
    for (const entry of this.entries.values()) {
      const visible = kindForZoom(entry.kind, this.currentZoom, this.opts)
      if (visible === entry.visible) continue
      entry.visible = visible
      // Hidden markers are removed (an invisible canvas marker still catches clicks).
      if (visible) this.group.addLayer(entry.marker)
      else this.group.removeLayer(entry.marker)
    }
  }

  destroy(): void {
    this.group.remove()
    this.renderer.remove()
    this.entries.clear()
    this.pois = []
  }
}