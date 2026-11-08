import L from 'leaflet'
import { cellsCoveringBounds, cellTokenAt, cellVertices, type Bounds } from '../core/s2'
import { shouldShowGrid } from '../core/grid-gating'

const VERTEX_CACHE_SIZE = 2048

class VertexCache {
  private map = new Map<string, [number, number][]>()

  get(token: string): [number, number][] | undefined {
    const v = this.map.get(token)
    if (v !== undefined) {
      this.map.delete(token)
      this.map.set(token, v)
    }
    return v
  }

  set(token: string, verts: [number, number][]): void {
    if (this.map.has(token)) {
      this.map.delete(token)
    }
    this.map.set(token, verts)
    if (this.map.size > VERTEX_CACHE_SIZE) {
      const first = this.map.keys().next()
      if (!first.done) this.map.delete(first.value)
    }
  }

  clear(): void {
    this.map.clear()
  }
}

export type CellStyleFn = (token: string) => {
  fillColor: string
  fillOpacity: number
  color?: string
  weight?: number
  dashArray?: string
} | null

export interface S2GridLayerOptions {
  level: 14 | 17
  minZoom: number
  maxCells: number
  color: string
  weight: number
  dashArray?: string
  cellStyle?: CellStyleFn
  onCellClick?: (token: string, lat: number, lng: number) => void
  onUpdated?: () => void
}

export class S2GridLayer {
  private layerGroup: L.LayerGroup
  private map: L.Map
  private opts: S2GridLayerOptions
  private cache = new VertexCache()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private hintEl: HTMLElement | null = null
  private destroyed = false
  /** True while polygons for the current view are on the map. */
  private drawn = false

  constructor(map: L.Map, opts: S2GridLayerOptions) {
    this.map = map
    this.opts = opts

    this.layerGroup = L.layerGroup()
    this.layerGroup.addTo(map)

    this.hintEl = document.createElement('div')
    this.hintEl.className = 's2-grid-hint'
    this.hintEl.style.cssText =
      'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);' +
      'z-index:1001;padding:4px 10px;background:rgba(0,0,0,0.6);color:#fff;' +
      'border-radius:4px;font-size:12px;pointer-events:none;display:none;'
    map.getContainer().appendChild(this.hintEl)

    this.map.on('moveend', this.handleMoveEnd)
    this.map.on('zoomend', this.handleMoveEnd)
    if (this.opts.onCellClick) this.map.on('click', this.handleMapClick)

    this.update()
  }

  // Cell selection is resolved at map level, not per polygon: the POI canvas sits above the grid
  // canvas and swallows clicks, so polygon handlers never fire while POIs are shown. A click on a
  // POI marker does not reach here (markers use bubblingMouseEvents: false).
  private handleMapClick = (e: L.LeafletMouseEvent): void => {
    if (this.destroyed || !this.drawn) return
    const { lat, lng } = e.latlng
    this.opts.onCellClick?.(cellTokenAt(lat, lng, this.opts.level), lat, lng)
  }

  private handleMoveEnd = (): void => {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.update(), 150)
  }

  update(): void {
    if (this.destroyed) return
    const perfStart = import.meta.env.DEV ? performance.now() : 0

    const zoom = this.map.getZoom()
    const gating = shouldShowGrid({
      zoom,
      minZoom: this.opts.minZoom,
      maxCells: this.opts.maxCells
    })

    if (!gating.visible) {
      this.clearPolygons()
      if (gating.hint) {
        this.hintEl!.textContent = gating.hint
        this.hintEl!.style.display = 'block'
      }
      return
    }

    if (this.hintEl) this.hintEl.style.display = 'none'

    const bounds = this.map.getBounds()
    const b: Bounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast()
    }

    const { tokens, truncated } = cellsCoveringBounds(b, this.opts.level, this.opts.maxCells)

    // Too many cells for this view: draw nothing rather than a misleading partial grid.
    if (truncated) {
      this.clearPolygons()
      if (this.hintEl) {
        this.hintEl.textContent = 'Zoom in to see the grid'
        this.hintEl.style.display = 'block'
      }
      return
    }
    if (this.hintEl) this.hintEl.style.display = 'none'

    this.clearPolygons()

    for (const token of tokens) {
      let verts = this.cache.get(token)
      if (!verts) {
        verts = cellVertices(token)
        this.cache.set(token, verts)
      }
      // Leaflet expects [lat, lng]
      const latlngs: L.LatLngExpression[] = verts.map(
        ([lat, lng]) => [lat, lng] as [number, number]
      )

      const style = this.opts.cellStyle?.(token) ?? null
      const polyOpts: L.PathOptions = {
        color: style?.color ?? this.opts.color,
        weight: style?.weight ?? this.opts.weight,
        dashArray: style?.dashArray ?? this.opts.dashArray,
        fill: style !== null,
        fillColor: style?.fillColor ?? this.opts.color,
        fillOpacity: style?.fillOpacity ?? 0,
        interactive: false
      }

      const poly = L.polygon(latlngs, polyOpts)
      ;(poly as L.Polygon & { _s2Token?: string })._s2Token = token

      poly.addTo(this.layerGroup)
    }

    this.drawn = true
    this.opts.onUpdated?.()

    if (import.meta.env.DEV) {
      const ms = performance.now() - perfStart
      console.debug(`[perf] S${this.opts.level} update ${ms.toFixed(1)}ms cells=${tokens.length}`)
    }
  }

  setCellStyle(fn: CellStyleFn | undefined): void {
    this.opts.cellStyle = fn
    this.refreshStyles()
  }

  refreshStyles(): void {
    const fn = this.opts.cellStyle
    if (!fn) return
    this.layerGroup.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        const token = (layer as L.Polygon & { _s2Token?: string })._s2Token
        if (token) {
          const style = fn(token) ?? null
          const polyOpts: L.PathOptions = {
            color: style?.color ?? this.opts.color,
            weight: style?.weight ?? this.opts.weight,
            dashArray: style?.dashArray ?? this.opts.dashArray,
            fill: style !== null,
            fillColor: style?.fillColor ?? this.opts.color,
            fillOpacity: style?.fillOpacity ?? 0
          }
          layer.setStyle(polyOpts)
        }
      }
    })
  }

  private clearPolygons(): void {
    this.drawn = false
    this.layerGroup.clearLayers()
  }

  destroy(): void {
    this.destroyed = true
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.map.off('moveend', this.handleMoveEnd)
    this.map.off('zoomend', this.handleMoveEnd)
    this.map.off('click', this.handleMapClick)
    this.layerGroup.remove()
    this.cache.clear()
    if (this.hintEl && this.hintEl.parentNode) {
      this.hintEl.parentNode.removeChild(this.hintEl)
    }
    this.hintEl = null
  }
}
