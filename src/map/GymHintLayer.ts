import L from 'leaflet'
import { gymHintDeclutterLimit, gymHintLabel, type GymHintCell } from '../core/gymHints'

export interface GymHintLayerOptions {
  /** Hints are shown from this zoom up (same as the S14 grid's minimum zoom). */
  minZoom: number
  /** The person's "at most N more" setting; zoomed out only the closest hints are drawn. */
  maxRemaining: number
}

/** Badges are created for cells inside the viewport padded by this ratio. */
const VIEWPORT_PAD = 0.25

/**
 * "+2 → 2nd gym" badges at the center of S14 cells that are close to their next gym. Badges are
 * not interactive (they never swallow a map click); the full sentence is in the cell popup.
 */
export class GymHintLayer {
  private map: L.Map
  private group: L.LayerGroup
  private opts: GymHintLayerOptions
  private hints: GymHintCell[] = []
  /** Badges currently on the map, by S14 token: a view change only adds/removes the delta. */
  private markers = new Map<string, L.Marker>()

  constructor(map: L.Map, opts: GymHintLayerOptions) {
    this.map = map
    this.opts = opts
    this.group = L.layerGroup().addTo(map)
    map.on('zoomend', this.handleViewChange)
    map.on('moveend', this.handleViewChange)
  }

  setHints(hints: GymHintCell[]): void {
    this.hints = hints
    this.clear()
    this.refresh()
  }

  setOptions(opts: Partial<GymHintLayerOptions>): void {
    const next = { ...this.opts, ...opts }
    if (next.minZoom === this.opts.minZoom && next.maxRemaining === this.opts.maxRemaining) return
    this.opts = next
    this.refresh()
  }

  private handleViewChange = (): void => {
    this.refresh()
  }

  private clear(): void {
    this.group.clearLayers()
    this.markers.clear()
  }

  private createMarker(cell: GymHintCell): L.Marker {
    const badge = document.createElement('span')
    badge.className = cell.partial ? 'gym-hint gym-hint--partial' : 'gym-hint'
    badge.textContent = gymHintLabel(cell)
    return L.marker([cell.lat, cell.lng], {
      icon: L.divIcon({ className: 'gym-hint-icon', html: badge, iconSize: [0, 0] }),
      interactive: false,
      keyboard: false
    })
  }

  private refresh(): void {
    const zoom = this.map.getZoom()
    if (zoom < this.opts.minZoom) {
      if (this.markers.size > 0) this.clear()
      return
    }
    const limit = gymHintDeclutterLimit(zoom, this.opts.maxRemaining)
    const b = this.map.getBounds().pad(VIEWPORT_PAD)
    const wanted = new Set<string>()
    for (const cell of this.hints) {
      if (cell.hint.remaining > limit || !b.contains([cell.lat, cell.lng])) continue
      wanted.add(cell.token)
      if (this.markers.has(cell.token)) continue
      const marker = this.createMarker(cell)
      this.markers.set(cell.token, marker)
      this.group.addLayer(marker)
    }
    for (const [token, marker] of this.markers) {
      if (wanted.has(token)) continue
      this.group.removeLayer(marker)
      this.markers.delete(token)
    }
  }

  destroy(): void {
    this.map.off('zoomend', this.handleViewChange)
    this.map.off('moveend', this.handleViewChange)
    this.group.remove()
    this.markers.clear()
    this.hints = []
  }
}
