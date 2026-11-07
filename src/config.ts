/** Default map center (lat, lng) — Timișoara, Romania. */
export const DEFAULT_CENTER: [number, number] = [45.7649, 21.2531]

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
