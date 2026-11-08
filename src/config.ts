export { DEFAULT_CENTER, DEFAULT_ZOOM } from './core/settings'

/**
 * Max cells drawn per grid layer; a view needing more shows a hint instead of a partial grid.
 * Touch (coarse pointer) devices get a lower cap. Desktop is 2500 so that a 1080p window at the
 * default S17 minimum zoom (16, ~1.7k cells) is not blank; lower it if panning feels heavy.
 */
export const GRID_MAX_CELLS: number =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(pointer: coarse)').matches
    ? 800
    : 2500
