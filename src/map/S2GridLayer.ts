/**
 * S2 grid overlay layer.
 * Draws S2 cell polygons at a given level (14 or 17) for the current map bounds.
 * Uses canvas renderer, debounced updates, and an LRU vertex cache.
 */
import L from 'leaflet'
import { cellsCoveringBounds, cellVertices, type Bounds } from '../core/s2'
import { shouldShowGrid } from '../core/grid-gating'

// --- Vertex cache (LRU) ---

const VERTEX_CACHE_SIZE = 2048

class VertexCache {
  private map = new Map<string, [number, number][]>()

  get(token: string): [number, number][] | undefined {
    const v = this.map.get(token)
    if (v !== undefined) {
      // Refresh: delete and re-insert to move to end (most recent)
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
    // Evict oldest if over capacity
    if (this.map.size > VERTEX_CACHE_SIZE) {
      const first = this.map.keys().next()
      if (!first.done) this.map.delete(first.value)
    }
  }

  clear(): void {
    this.map.clear()
  }
}

// --- Layer options ---

/** Per-cell style callback: returns fill properties for a given token. */
export type CellStyleFn = (token: string) => {
  fillColor: string
  fillOpacity: number
  /** Optional stroke color override. */
  color?: string
  /** Optional stroke width override. */
  weight?: number
  /** Optional dash pattern. */
  dashArray?: string
} | null

export interface S2GridLayerOptions {
  /** S2 level: 14 or 17. */
  level: 14 | 17
  /** Minimum zoom to show the grid. */
  minZoom: number
  /** Maximum number of cells to draw. */
  maxCells: number
  /** Stroke color. */
  color: string
  /** Stroke width in px. */
  weight: number
  /** Optional per-cell style function. If null/absent, no fill. */
  cellStyle?: CellStyleFn
  /** Optional click handler for cell popups. */
  onCellClick?: (token: string, lat: number, lng: number) => void
}

// --- Layer ---

export class S2GridLayer {
  private layerGroup: L.LayerGroup
  private map: L.Map
  private opts: S2GridLayerOptions
  private cache = new VertexCache()
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private hintEl: HTMLElement | null = null
  private destroyed = false

  constructor(map: L.Map, opts: S2GridLayerOptions) {
    this.map = map
    this.opts = opts

    this.layerGroup = L.layerGroup()
    this.layerGroup.addTo(map)

    // Create hint element
    this.hintEl = document.createElement('div')
    this.hintEl.className = 's2-grid-hint'
    this.hintEl.style.cssText =
      'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);' +
      'z-index:1001;padding:4px 10px;background:rgba(0,0,0,0.6);color:#fff;' +
      'border-radius:4px;font-size:12px;pointer-events:none;display:none;'
    map.getContainer().appendChild(this.hintEl)

    // Listen to map events
    this.map.on('moveend', this.handleMoveEnd)
    this.map.on('zoomend', this.handleMoveEnd)

    // Initial draw
    this.update()
  }

  private handleMoveEnd = (): void => {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.update(), 150)
  }

  /** Compute cells for current bounds and draw polygons. */
  update(): void {
    if (this.destroyed) return

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
        dashArray: style?.dashArray,
        fill: style !== null,
        fillColor: style?.fillColor ?? this.opts.color,
        fillOpacity: style?.fillOpacity ?? 0,
        interactive: this.opts.onCellClick !== undefined
      }

      const poly = L.polygon(latlngs, polyOpts)

      if (this.opts.onCellClick) {
        poly.on('click', (e: L.LeafletMouseEvent) => {
          this.opts.onCellClick!(token, e.latlng.lat, e.latlng.lng)
        })
      }

      poly.addTo(this.layerGroup)
    }

    // If truncated, we could show a subtle indicator, but for now just cap
    void truncated
  }

  private clearPolygons(): void {
    this.layerGroup.clearLayers()
  }

  /** Remove the layer and clean up all resources. */
  destroy(): void {
    this.destroyed = true
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.map.off('moveend', this.handleMoveEnd)
    this.map.off('zoomend', this.handleMoveEnd)
    this.layerGroup.remove()
    this.cache.clear()
    if (this.hintEl && this.hintEl.parentNode) {
      this.hintEl.parentNode.removeChild(this.hintEl)
    }
    this.hintEl = null
  }
}
