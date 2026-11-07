/**
 * POI marker layer — draws circle markers on the canvas renderer.
 * Colors/shapes differ per kind. Zoom-based filtering.
 * Popup with title, description, address, kind, status; image loaded lazily.
 */
import L from 'leaflet'
import type { ParsedPoi } from '../core/wayfarer/parse'
import { poiKind, type PoiKind } from '../core/classify'

export interface PoiLayerOptions {
  /** Minimum zoom to show all POI kinds. Below this, only stop/gym. */
  fullDetailZoom: number
  /** Whether to show 'other' kind POIs. */
  showOther: boolean
  /** Whether to show only stop/gym (hide powerspot and other). */
  stopGymOnly: boolean
}

export const DEFAULT_POI_LAYER_OPTS: PoiLayerOptions = {
  fullDetailZoom: 16,
  showOther: true,
  stopGymOnly: false
}

const KIND_COLORS: Record<PoiKind, string> = {
  stop: '#3b82f6',
  gym: '#ef4444',
  powerspot: '#f59e0b',
  other: '#9ca3af'
}

const KIND_RADIUS: Record<PoiKind, number> = {
  stop: 5,
  gym: 6,
  powerspot: 4,
  other: 3
}

function kindForZoom(kind: PoiKind, zoom: number, opts: PoiLayerOptions): boolean {
  if (opts.stopGymOnly && kind !== 'stop' && kind !== 'gym') return false
  if (!opts.showOther && kind === 'other') return false
  if (zoom < opts.fullDetailZoom && kind !== 'stop' && kind !== 'gym') return false
  return true
}

function buildPopupHtml(poi: ParsedPoi, kind: PoiKind): string {
  const parts: string[] = []
  if (poi.title) parts.push(`<strong>${escapeHtml(poi.title)}</strong>`)
  if (poi.description) parts.push(`<p>${escapeHtml(poi.description)}</p>`)
  if (poi.address) parts.push(`<small>${escapeHtml(poi.address)}</small>`)
  parts.push(`<em>${kind}</em>`)
  return parts.join('\n')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export class PoiLayer {
  private group: L.LayerGroup
  private pois: ParsedPoi[] = []
  private opts: PoiLayerOptions
  private markers = new Map<string, L.CircleMarker>()
  private currentZoom = 12

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

  setOptions(opts: Partial<PoiLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.refreshVisibility()
  }

  private rebuild(): void {
    this.group.clearLayers()
    this.markers.clear()

    for (const poi of this.pois) {
      const kind = poiKind(poi)
      const marker = L.circleMarker([poi.lat, poi.lng], {
        radius: KIND_RADIUS[kind],
        color: KIND_COLORS[kind],
        fillColor: KIND_COLORS[kind],
        fillOpacity: 0.7,
        weight: 1,
        opacity: 0.9
      })

      // Lazy popup: build HTML on open, load image only then
      marker.bindPopup(() => {
        let html = buildPopupHtml(poi, kind)
        if (poi.imageUrl) {
          html += `<br><img src="${poi.imageUrl}" style="max-width:200px;max-height:150px;border-radius:4px" loading="lazy">`
        }
        return html
      })

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
        marker.setStyle({ opacity: 0.9, fillOpacity: 0.7 })
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
