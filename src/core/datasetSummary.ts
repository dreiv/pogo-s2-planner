import type { ParsedCell, ParsedPoi } from './wayfarer/parse'

export interface DatasetSummary {
  poiCount: number
  /** S14 cells present in the data (= the area the app has real information about). */
  cellCount: number
  /** S14 cells with 50+ POIs, whose free S17 cells cannot be trusted. */
  incompleteCellCount: number
  /** Newest snapshot date among the cells (epoch ms), or null when none is known. */
  latestSnapshot: number | null
}

export function summarizeDataset(
  pois: readonly ParsedPoi[],
  cells: readonly ParsedCell[]
): DatasetSummary {
  let incomplete = 0
  let latest: number | null = null
  for (const c of cells) {
    if (c.truncated) incomplete++
    if (c.snapshot !== null && (latest === null || c.snapshot > latest)) latest = c.snapshot
  }
  return {
    poiCount: pois.length,
    cellCount: cells.length,
    incompleteCellCount: incomplete,
    latestSnapshot: latest
  }
}

/** `YYYY-MM-DD` (UTC, like the Wayfarer snapshot string), or null. */
export function formatSnapshotDate(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms)) return null
  return new Date(ms).toISOString().slice(0, 10)
}
