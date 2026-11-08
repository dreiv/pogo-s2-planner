import L from 'leaflet'
import { cellsIntersectingCircle } from '../core/geo'
import { cellVertices } from '../core/s2'
import { RANGE_COLORS } from '../theme'

export interface RangeLayerOptions {
  radius: number
  minRadius: number
  maxRadius: number
  showS17: boolean
  showS14: boolean
}

export const DEFAULT_RANGE_OPTS: RangeLayerOptions = {
  radius: 80,
  minRadius: 20,
  maxRadius: 500,
  showS17: true,
  showS14: true
}

export class RangeLayer {
  private map: L.Map
  private opts: RangeLayerOptions
  private circle: L.Circle | null = null
  private centerMarker: L.Marker | null = null
  private cellGroup: L.LayerGroup
  private center: [number, number] | null = null
  private onCenterChange: ((lat: number, lng: number) => void) | null = null

  constructor(map: L.Map, opts: Partial<RangeLayerOptions> = {}) {
    this.map = map
    this.opts = { ...DEFAULT_RANGE_OPTS, ...opts }
    this.cellGroup = L.layerGroup()
    this.cellGroup.addTo(map)

    this.map.on('click', this.handleMapClick)
  }

  setCenter(lat: number, lng: number): void {
    this.center = [lat, lng]
    this.update()
  }

  setRadius(radius: number): void {
    this.opts.radius = Math.max(this.opts.minRadius, Math.min(this.opts.maxRadius, radius))
    this.update()
  }

  setOptions(opts: Partial<RangeLayerOptions>): void {
    this.opts = { ...this.opts, ...opts }
    this.update()
  }

  onCenterChanged(cb: (lat: number, lng: number) => void): void {
    this.onCenterChange = cb
  }

  private handleMapClick = (e: L.LeafletMouseEvent): void => {
    this.center = [e.latlng.lat, e.latlng.lng]
    this.update()
    this.onCenterChange?.(e.latlng.lat, e.latlng.lng)
  }

  private update(): void {
    if (!this.center) return
    const [lat, lng] = this.center

    if (this.circle) {
      this.circle.remove()
      this.circle = null
    }
    if (this.centerMarker) {
      this.centerMarker.remove()
      this.centerMarker = null
    }

    this.circle = L.circle([lat, lng], {
      radius: this.opts.radius,
      color: RANGE_COLORS.circle,
      fillColor: RANGE_COLORS.circle,
      fillOpacity: 0.1,
      weight: 2,
      dashArray: '6 4'
    }).addTo(this.map)

    const icon = L.divIcon({
      className: 'range-center-icon',
      html: `<div style="width:12px;height:12px;border-radius:50%;background:${RANGE_COLORS.circle};border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.3)"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    })
    this.centerMarker = L.marker([lat, lng], { icon, interactive: false }).addTo(this.map)

    this.updateCellHighlights()
  }

  private updateCellHighlights(): void {
    this.cellGroup.clearLayers()
    if (!this.center) return
    const [lat, lng] = this.center

    if (this.opts.showS17) {
      const s17Cells = cellsIntersectingCircle(lat, lng, this.opts.radius, 17)
      for (const cell of s17Cells) {
        this.addCellOutline(cell.token, RANGE_COLORS.s17Outline)
      }
    }

    if (this.opts.showS14) {
      const s14Cells = cellsIntersectingCircle(lat, lng, this.opts.radius, 14)
      for (const cell of s14Cells) {
        this.addCellOutline(cell.token, RANGE_COLORS.s14Outline)
      }
    }
  }

  private addCellOutline(token: string, color: string): void {
    const verts = cellVertices(token)
    const latlngs: L.LatLngExpression[] = verts.map(
      ([vLat, vLng]) => [vLat, vLng] as [number, number]
    )
    const poly = L.polygon(latlngs, {
      color,
      weight: 3,
      fill: false,
      interactive: false
    })
    poly.addTo(this.cellGroup)
  }

  destroy(): void {
    this.map.off('click', this.handleMapClick)
    if (this.circle) this.circle.remove()
    if (this.centerMarker) this.centerMarker.remove()
    this.cellGroup.remove()
    this.circle = null
    this.centerMarker = null
    this.center = null
  }
}
