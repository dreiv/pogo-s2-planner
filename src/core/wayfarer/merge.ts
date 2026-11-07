/**
 * Merge successive Wayfarer imports (pure).
 *
 * Rules (D-012):
 *  - An incoming S14 cell is AUTHORITATIVE for the POIs of that cell: POIs of that cell
 *    that are missing from the incoming cell are removed (they disappeared in Wayfarer).
 *  - Exception: if the incoming cell is truncated (count >= 50) we cannot know what is
 *    missing, so POIs are only unioned by poiId (incoming wins on conflict).
 *  - An incoming cell is ignored only when BOTH cells have a known time and the incoming
 *    one is strictly older. Unknown time => the incoming import wins (last import wins).
 *  - Cells (coverage): union by token; empty cells ({count:0}) are kept: they mean "free".
 *  - POIs whose cellToken is not among the incoming cells are unioned by poiId.
 *  - Idempotent: merging the same import twice gives the same result.
 *  - Output is sorted (cells by token, POIs by id) so results are deterministic.
 */
import type { ParsedCell, ParsedPoi } from './parse'

export interface MergeInput {
  cells: ParsedCell[]
  pois: ParsedPoi[]
  /** Kept for compatibility. Only informational; it no longer decides conflicts. */
  importTimestamp: number
}

export interface MergeStats {
  poisAdded: number
  poisUpdated: number
  poisRemoved: number
  poisUnchanged: number
  cellsAdded: number
  cellsUpdated: number
  /** Incoming cells ignored because the stored cell is strictly newer. */
  cellsSkippedOlder: number
}

export interface MergeResult {
  cells: ParsedCell[]
  pois: ParsedPoi[]
  stats: MergeStats
}

export function emptyMergeStats(): MergeStats {
  return {
    poisAdded: 0,
    poisUpdated: 0,
    poisRemoved: 0,
    poisUnchanged: 0,
    cellsAdded: 0,
    cellsUpdated: 0,
    cellsSkippedOlder: 0
  }
}

function cellTime(c: ParsedCell): number | null {
  return c.generatedTimestamp ?? c.snapshot ?? null
}

function isStrictlyOlder(incoming: ParsedCell, stored: ParsedCell): boolean {
  const a = cellTime(incoming)
  const b = cellTime(stored)
  return a !== null && b !== null && a < b
}

function poiEquals(a: ParsedPoi, b: ParsedPoi): boolean {
  return (
    a.id === b.id &&
    a.lat === b.lat &&
    a.lng === b.lng &&
    a.title === b.title &&
    a.description === b.description &&
    a.address === b.address &&
    a.imageUrl === b.imageUrl &&
    a.communityContributed === b.communityContributed &&
    a.cellToken === b.cellToken &&
    JSON.stringify(a.game) === JSON.stringify(b.game)
  )
}

function groupByCell(pois: ParsedPoi[]): Map<string, ParsedPoi[]> {
  const m = new Map<string, ParsedPoi[]>()
  for (const p of pois) {
    const list = m.get(p.cellToken)
    if (list) list.push(p)
    else m.set(p.cellToken, [p])
  }
  return m
}

/** Pure; does not mutate inputs. */
export function mergeImports(existing: MergeInput, incoming: MergeInput): MergeResult {
  const stats = emptyMergeStats()
  const existingCells = new Map(existing.cells.map((c) => [c.token, c] as const))
  const incomingCells = new Map(incoming.cells.map((c) => [c.token, c] as const)) // last wins
  const cells = new Map(existingCells)
  const pois = new Map(existing.pois.map((p) => [p.id, p] as const))
  const existingByCell = groupByCell(existing.pois)
  const incomingByCell = groupByCell(incoming.pois)

  // 1. Decide which incoming cells are accepted.
  const accepted: ParsedCell[] = []
  for (const inCell of incomingCells.values()) {
    const stored = existingCells.get(inCell.token)
    if (stored && isStrictlyOlder(inCell, stored)) {
      stats.cellsSkippedOlder++
      continue
    }
    accepted.push(inCell)
  }

  // 2. All POI ids that the accepted cells (or orphan POIs) bring.
  const keepIds = new Set<string>()
  for (const c of accepted) for (const p of incomingByCell.get(c.token) ?? []) keepIds.add(p.id)
  const orphans = incoming.pois.filter((p) => !incomingCells.has(p.cellToken))
  for (const p of orphans) keepIds.add(p.id)

  // 3. Remove POIs that vanished from accepted, non-truncated cells.
  for (const c of accepted) {
    if (c.truncated) continue
    for (const p of existingByCell.get(c.token) ?? []) {
      if (!keepIds.has(p.id) && pois.delete(p.id)) stats.poisRemoved++
    }
  }

  // 4. Upsert incoming POIs and cells.
  const upsert = (p: ParsedPoi): void => {
    const prev = pois.get(p.id)
    if (!prev) stats.poisAdded++
    else if (poiEquals(prev, p)) stats.poisUnchanged++
    else stats.poisUpdated++
    pois.set(p.id, p)
  }
  for (const c of accepted) {
    for (const p of incomingByCell.get(c.token) ?? []) upsert(p)
    if (existingCells.has(c.token)) stats.cellsUpdated++
    else stats.cellsAdded++
    cells.set(c.token, c)
  }
  for (const p of orphans) upsert(p)

  return {
    cells: [...cells.values()].sort((a, b) => (a.token < b.token ? -1 : a.token > b.token ? 1 : 0)),
    pois: [...pois.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    stats
  }
}

/** Fold several imports into `existing`, in order. Stats are summed. */
export function mergeMany(existing: MergeInput, incomings: MergeInput[]): MergeResult {
  let acc: MergeInput = existing
  const total = emptyMergeStats()
  for (const inc of incomings) {
    const r = mergeImports(acc, inc)
    acc = {
      cells: r.cells,
      pois: r.pois,
      importTimestamp: Math.max(acc.importTimestamp, inc.importTimestamp)
    }
    for (const k of Object.keys(total) as (keyof MergeStats)[]) total[k] += r.stats[k]
  }
  return { cells: acc.cells, pois: acc.pois, stats: total }
}
