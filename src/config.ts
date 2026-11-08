export const DEFAULT_CENTER: [number, number] = [45.7649, 21.2531]

export const DEFAULT_ZOOM = 13

/** Touch (coarse pointer) devices get a lower cap. */
export const GRID_MAX_CELLS: number =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches
    ? 800
    : 1500
