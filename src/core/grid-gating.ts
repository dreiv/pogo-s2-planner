/**
 * Pure gating logic for S2 grid overlay.
 * Decides whether to draw a grid layer based on zoom level and cell count.
 */

export interface GridGatingInput {
  zoom: number
  minZoom: number
  maxCells: number
}

export interface GridGatingResult {
  /** Whether the grid should be visible at this zoom. */
  visible: boolean
  /** If not visible, a hint message (or null). */
  hint: string | null
}

/**
 * Decide if a grid layer should be drawn.
 * - zoom < minZoom → not visible, hint "zoom in"
 * - zoom >= minZoom → visible
 */
export function shouldShowGrid(input: GridGatingInput): GridGatingResult {
  if (input.zoom < input.minZoom) {
    return {
      visible: false,
      hint: `Zoom in to see the grid (min zoom ${input.minZoom})`
    }
  }
  return { visible: true, hint: null }
}

/**
 * Clamp the number of cells to draw.
 * Returns the effective cell count and whether it was capped.
 */
export function clampCellCount(
  requested: number,
  maxCells: number
): { count: number; capped: boolean } {
  if (requested > maxCells) {
    return { count: maxCells, capped: true }
  }
  return { count: requested, capped: false }
}
