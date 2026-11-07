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

export class PoiLayer {
  private group: L.LayerGroup
  private pois: ParsedPoi[] = []
  private opts: PoiLayerOptions
  private markers = new Map<string, L.CircleMarker>()
  private currentZoom = 12
  /** Read-only counter: incremented each time markers are (re)built. For tests. */
  rebuildCount = 0

  constructor(map: L.Map, opts: Partial<PoiLayerOptions> = {}) {
    this.opts = { ...DEFAULT_POI_LAYER_OPTS, ...opts }
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
    for (const marker of this.markers.values()) {
      marker.bringToFront()
    }
  }

  setOptions(opts: Partial<PoiLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.refreshVisibility()
  }

  private rebuild(): void {
    this.rebuildCount++
    this.group.clearLayers()
    this.markers.clear()

    for (const poi of this.pois) {
      const kind = poiKind(poi)
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: KIND_RADIUS[kind],
        color: '#ffffff',
        weight: 2,
        fillColor: POI_COLORS[kind],
        fillOpacity: 1,
        opacity: 1
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
        { maxWidth: 280 }
      )

      this.markers.set(poi.id, marker)
      this.group.addLayer(marker)
    }
    this.refreshVisibility()
  }

  private refreshVisibility(): void {
    for (const [id, marker] of this.markers) {
      const poi = this.pois.find((p) => p.id === id)
      if (!poi) continue
      const kind = poiKind(poi)
      const visible = kindForZoom(kind, this.currentZoom, this.opts)
      if (visible) {
        marker.setStyle({ opacity: 1, fillOpacity: 1 })
      } else {
        marker.setStyle({ opacity: 0, fillOpacity: 0 })
      }
    }
  }

  destroy(): void {
    this.group.remove()
    this.markers.clear()
    this.pois = []
  }
}
