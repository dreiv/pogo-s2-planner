/**
 * Merge successive Wayfarer imports.
 * - POIs: deduplicate by poiId; on conflict, the newer snapshot/timestamp wins.
 * - Cells: union by token; on conflict, the newer one wins.
 * Idempotent: merging the same import twice yields the same result.
 */
import type { ParsedCell, ParsedPoi } from './parse'

export interface MergeInput {
  cells: ParsedCell[]
  pois: ParsedPoi[]
  /** Timestamp for this import (for conflict resolution). */
  importTimestamp: number
}

export interface MergeResult {
  cells: ParsedCell[]
  pois: ParsedPoi[]
}

/**
 * Merge a new import into existing data.
 * Returns the combined result. Pure function — does not mutate inputs.
 */
export function mergeImports(existing: MergeInput, incoming: MergeInput): MergeResult {
  // --- Merge POIs ---
  const poiMap = new Map<string, { poi: ParsedPoi; ts: number }>()

  for (const poi of existing.pois) {
    poiMap.set(poi.id, { poi, ts: existing.importTimestamp })
  }

  for (const poi of incoming.pois) {
    const prev = poiMap.get(poi.id)
    if (!prev) {
      poiMap.set(poi.id, { poi, ts: incoming.importTimestamp })
    } else if (incoming.importTimestamp >= prev.ts) {
      // Newer or equal wins
      poiMap.set(poi.id, { poi, ts: incoming.importTimestamp })
    }
    // else: existing is newer, keep it
  }

  const pois = Array.from(poiMap.values(), (v) => v.poi)

  // --- Merge Cells ---
  const cellMap = new Map<string, { cell: ParsedCell; ts: number }>()

  for (const cell of existing.cells) {
    cellMap.set(cell.token, { cell, ts: existing.importTimestamp })
  }

  for (const cell of incoming.cells) {
    const prev = cellMap.get(cell.token)
    if (!prev) {
      cellMap.set(cell.token, { cell, ts: incoming.importTimestamp })
    } else if (incoming.importTimestamp >= prev.ts) {
      cellMap.set(cell.token, { cell, ts: incoming.importTimestamp })
    }
  }

  const cells = Array.from(cellMap.values(), (v) => v.cell)

  return { cells, pois }
}
