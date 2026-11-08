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
  /** Message to show while the grid is hidden (zoom/cell-count gating), or null to clear it. */
  onHint?: (message: string | null) => void
}

export class S2GridLayer {
  private layerGroup: L.LayerGroup
  private map: L.Map
  private opts: S2GridLayerOptions
  private cache = new VertexCache()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private destroyed = false
  /** Polygons currently on the map, by S2 token: a view change only adds/removes the delta. */
  private polys = new Map<string, L.Polygon>()

  constructor(map: L.Map, opts: S2GridLayerOptions) {
    this.map = map
    this.opts = opts

    this.layerGroup = L.layerGroup()
    this.layerGroup.addTo(map)

    this.map.on('moveend', this.handleMoveEnd)
    this.map.on('zoomend', this.handleMoveEnd)
    if (this.opts.onCellClick) this.map.on('click', this.handleMapClick)

    this.update()
  }

  // Cell selection is resolved at map level, not per polygon: the POI canvas sits above the grid
  // canvas and swallows clicks, and polygons are non-interactive (no per-polygon listeners).
  // A click on a POI marker does not reach here (markers use bubblingMouseEvents: false).
  private handleMapClick = (e: L.LeafletMouseEvent): void => {
    if (this.destroyed || this.polys.size === 0) return
    const { lat, lng } = e.latlng
    this.opts.onCellClick?.(cellTokenAt(lat, lng, this.opts.level), lat, lng)
  }

  private handleMoveEnd = (): void => {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.update(), 150)
  }

  private styleOptions(token: string): L.PathOptions {
    const style = this.opts.cellStyle?.(token) ?? null
    return {
      color: style?.color ?? this.opts.color,
      weight: style?.weight ?? this.opts.weight,
      dashArray: style?.dashArray ?? this.opts.dashArray,
      fill: style !== null,
      fillColor: style?.fillColor ?? this.opts.color,
      fillOpacity: style?.fillOpacity ?? 0
    }
  }

  private createPolygon(token: string): L.Polygon {
    let verts = this.cache.get(token)
    if (!verts) {
      verts = cellVertices(token)
      this.cache.set(token, verts)
    }
    // Leaflet expects [lat, lng]
    const latlngs: L.LatLngExpression[] = verts.map(
      ([lat, lng]) => [lat, lng] as [number, number]
    )
    return L.polygon(latlngs, { ...this.styleOptions(token), interactive: false })
  }

  private hide(message: string | null): void {
    this.clearPolygons()
    this.opts.onHint?.(message)
  }

  update(): void {
    if (this.destroyed) return
    const perfStart = import.meta.env.DEV ? performance.now() : 0

    const bounds = this.map.getBounds()
    const b: Bounds = {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast()
    }

    // Zoom and estimated cell count are checked first, so a hopeless view never pays for covering.
    const gating = shouldShowGrid({
      zoom: this.map.getZoom(),
      minZoom: this.opts.minZoom,
      maxCells: this.opts.maxCells,
      bounds: b,
      level: this.opts.level
    })
    if (!gating.visible) {
      this.hide(gating.hint)
      return
    }

    const { tokens, truncated } = cellsCoveringBounds(b, this.opts.level, this.opts.maxCells)

    // Too many cells for this view: draw nothing rather than a misleading partial grid.
    if (truncated) {
      this.hide(`Too many cells in view: zoom in to see the S${this.opts.level} grid`)
      return
    }
    this.opts.onHint?.(null)

    // Diff against what is already drawn: panning keeps most polygons untouched.
    const wanted = new Set(tokens)
    for (const [token, poly] of this.polys) {
      if (!wanted.has(token)) {
        this.layerGroup.removeLayer(poly)
        this.polys.delete(token)
      }
    }
    for (const token of tokens) {
      if (this.polys.has(token)) continue
      const poly = this.createPolygon(token)
      this.layerGroup.addLayer(poly)
      this.polys.set(token, poly)
    }

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
    if (!this.opts.cellStyle) return
    for (const [token, poly] of this.polys) poly.setStyle(this.styleOptions(token))
  }

  private clearPolygons(): void {
    this.polys.clear()
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
    this.polys.clear()
    this.opts.onHint?.(null)
  }
}
