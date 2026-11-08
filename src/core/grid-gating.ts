import type { Bounds } from './s2'

export interface GridGatingInput {
  zoom: number
  minZoom: number
  maxCells: number
  /** With both `bounds` and `level`, the cell count is estimated before any covering runs. */
  bounds?: Bounds
  level?: number
}

export interface GridGatingResult {
  visible: boolean
  hint: string | null
}

const EARTH_AREA_KM2 = 510_072_000
const KM_PER_DEGREE = 111.32
/** `cellsCoveringBounds` pads the viewport by 10% on every side. */
const COVERING_PAD = 1.2 * 1.2
/**
 * Average cell area varies across the sphere and the estimate ignores edge effects, so only
 * views that exceed the cap by this factor skip the exact covering; borderline views still
 * get the exact count (and its truncation check) in the layer.
 */
const ESTIMATE_SLACK = 1.5

/** Average S2 cell area (km²) at a level: the sphere splits into 6 * 4^level cells. */
export function averageCellAreaKm2(level: number): number {
  return EARTH_AREA_KM2 / (6 * 4 ** level)
}

/** Cheap estimate of how many cells of `level` cover `bounds` (padded like the real covering). */
export function estimateCellCount(bounds: Bounds, level: number): number {
  const latSpan = Math.max(0, bounds.north - bounds.south)
  const lngSpan = Math.max(0, bounds.east - bounds.west)
  const midLat = ((bounds.north + bounds.south) / 2) * (Math.PI / 180)
  const heightKm = latSpan * KM_PER_DEGREE
  const widthKm = lngSpan * KM_PER_DEGREE * Math.max(0.01, Math.cos(midLat))
  return (heightKm * widthKm * COVERING_PAD) / averageCellAreaKm2(level)
}

export function shouldShowGrid(input: GridGatingInput): GridGatingResult {
  if (input.zoom < input.minZoom) {
    return {
      visible: false,
      hint:
        input.level !== undefined
          ? `Zoom in to see the S${input.level} grid (min zoom ${input.minZoom})`
          : `Zoom in to see the grid (min zoom ${input.minZoom})`
    }
  }
  if (input.bounds && input.level !== undefined) {
    const estimate = estimateCellCount(input.bounds, input.level)
    if (estimate > input.maxCells * ESTIMATE_SLACK) {
      return {
        visible: false,
        hint: `Too many cells in view: zoom in to see the S${input.level} grid`
      }
    }
  }
  return { visible: true, hint: null }
}

export function clampCellCount(
  requested: number,
  maxCells: number
): { count: number; capped: boolean } {
  if (requested > maxCells) {
    return { count: maxCells, capped: true }
  }
  return { count: requested, capped: false }
}
