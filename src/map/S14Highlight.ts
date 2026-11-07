import L from 'leaflet'
import { cellVertices } from '../core/s2'

export class S14Highlight {
  private layer: L.Polygon | null = null

  constructor(private readonly map: L.Map) {}

  show(token: string | null): void {
    this.clear()
    if (!token) return
    this.layer = L.polygon(cellVertices(token), {
      color: '#0ea5e9',
      weight: 4,
      fill: false,
      interactive: false
    }).addTo(this.map)
  }

  clear(): void {
    this.layer?.remove()
    this.layer = null
  }
}
