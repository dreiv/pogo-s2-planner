export interface GridGatingInput {
  zoom: number
  minZoom: number
  maxCells: number
}

export interface GridGatingResult {
  visible: boolean
  hint: string | null
}

export function shouldShowGrid(input: GridGatingInput): GridGatingResult {
  if (input.zoom < input.minZoom) {
    return {
      visible: false,
      hint: `Zoom in to see the grid (min zoom ${input.minZoom})`
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
