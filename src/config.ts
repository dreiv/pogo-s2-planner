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

/** Where to get the Wayfarer data the app imports (also linked from "No data" cells). */
export const WAYFARER_URL = 'https://wayfarer.scopely.com/mapview?z=16'

/** From this zoom on, Power Spots and non-game POIs are drawn (below it only stops and gyms). */
export const POI_FULL_DETAIL_ZOOM = 16

/** The "zoom in for more POIs" map hint appears from this zoom up to POI_FULL_DETAIL_ZOOM. */
export const POI_HINT_MIN_ZOOM = 14
