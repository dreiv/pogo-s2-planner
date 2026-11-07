/** Default map center (lat, lng) — Bucharest, Romania. */
export const DEFAULT_CENTER: [number, number] = [44.4268, 26.1025]

/** Default zoom level. */
export const DEFAULT_ZOOM = 13

/**
 * Maximum number of grid cells to draw.
 * Coarse pointers (touch) get a lower cap to keep the UI responsive.
 */
export const GRID_MAX_CELLS: number =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches
    ? 800
    : 1500
