import type { PoiKind } from './classify'

const TILE_PX = 256
/** Larger than any bucket row index we can produce below full detail zoom. */
const BUCKET_STRIDE = 2 ** 26

/** Lower number = more important; wins a bucket. */
const KIND_PRIORITY: Record<PoiKind, number> = { gym: 0, stop: 1, powerspot: 2, other: 3 }

/** Marker radius never drops below this (px), so dots stay tappable. */
export const MIN_MARKER_RADIUS = 3

export interface ThinCandidate {
  id: string
  kind: PoiKind
  /** Web Mercator position normalised to 0..1 (see toWorld). Zoom independent. */
  nx: number
  ny: number
}

/** Web Mercator position in 0..1 on both axes; multiply by 256 * 2^zoom for world pixels. */
export function toWorld(lat: number, lng: number): { nx: number; ny: number } {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat))
  const sin = Math.sin((clamped * Math.PI) / 180)
  return {
    nx: (lng + 180) / 360,
    ny: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)
  }
}

/**
 * Side (px) of the screen squares that get a single POI. 0 = show everything. Grows as the map
 * zooms out and is 0 from `fullDetailZoom` up, where every POI is drawn.
 */
export function thinCellPx(zoom: number, fullDetailZoom: number): number {
  const gap = fullDetailZoom - Math.floor(zoom)
  if (gap <= 0) return 0
  if (gap === 1) return 14
  if (gap === 2) return 20
  return 26
}

/** Dots shrink when zoomed out (1 at full detail zoom). */
export function poiMarkerScale(zoom: number, fullDetailZoom: number): number {
  const gap = fullDetailZoom - Math.floor(zoom)
  if (gap <= 0) return 1
  if (gap === 1) return 0.85
  if (gap === 2) return 0.7
  return 0.55
}

export function scaledMarkerRadius(baseRadius: number, scale: number): number {
  return Math.max(MIN_MARKER_RADIUS, Math.round(baseRadius * scale))
}

function better(a: ThinCandidate, b: ThinCandidate): boolean {
  const pa = KIND_PRIORITY[a.kind]
  const pb = KIND_PRIORITY[b.kind]
  if (pa !== pb) return pa < pb
  return a.id < b.id
}

/**
 * Keeps one candidate per `cellPx` x `cellPx` screen square (gym before stop, then by id).
 * Squares are aligned to the world pixel grid of the integer zoom, so the choice does not
 * depend on where the viewport is: panning never makes a dot swap with its neighbour.
 */
export function thinPois<T extends ThinCandidate>(
  candidates: readonly T[],
  zoom: number,
  cellPx: number
): Set<T> {
  if (cellPx <= 0) return new Set(candidates)
  const world = TILE_PX * 2 ** Math.floor(zoom)
  const best = new Map<number, T>()
  for (const c of candidates) {
    const bx = Math.floor((c.nx * world) / cellPx)
    const by = Math.floor((c.ny * world) / cellPx)
    const key = bx * BUCKET_STRIDE + by
    const cur = best.get(key)
    if (cur === undefined || better(c, cur)) best.set(key, c)
  }
  return new Set(best.values())
}
