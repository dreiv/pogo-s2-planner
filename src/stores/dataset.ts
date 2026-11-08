import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { db, type ImportRecord } from '../data/db'
import { parseWayfarer, type ParsedCell, type ParsedPoi } from '../core/wayfarer/parse'
import { mergeMany, type MergeStats } from '../core/wayfarer/merge'
import { poiKind } from '../core/classify'
import defaultFixture from '../../fixtures/wayfarer-sample.json'

export interface ImportSummary {
  documents: number
  poisAdded: number
  poisUpdated: number
  poisRemoved: number
  poisUnchanged: number
  cellsAdded: number
  cellsUpdated: number
  cellsSkippedOlder: number
  warnings: string[]
  // Legacy fields (kept for compatibility)
  poiCount: number
  stopCount: number
  gymCount: number
  powerSpotCount: number
  noGmoCount: number
  cellCount: number
  truncatedCount: number
  warningCount: number
}

interface DatasetState {
  pois: ParsedPoi[]
  cells: ParsedCell[]
  imports: ImportRecord[]
  loaded: boolean
  revision: number
}

function countByKind(pois: ParsedPoi[]): {
  stop: number
  gym: number
  powerSpot: number
  noGmo: number
} {
  let stop = 0,
    gym = 0,
    powerSpot = 0,
    noGmo = 0
  for (const poi of pois) {
    const kind = poiKind(poi)
    if (kind === 'stop') stop++
    else if (kind === 'gym') gym++
    else if (kind === 'powerspot') powerSpot++
    else noGmo++
  }
  return { stop, gym, powerSpot, noGmo }
}

export const useDatasetStore = defineStore('dataset', {
  state: (): DatasetState => ({
    pois: [],
    cells: [],
    imports: [],
    loaded: false,
    revision: 0
  }),

  actions: {
    async load(): Promise<void> {
      if (this.loaded) return
      const [pois, cells, imports] = await Promise.all([
        db.pois.toArray(),
        db.cells.toArray(),
        db.imports.orderBy('importedAt').reverse().toArray()
      ])
      // First open (empty DB, never imported): seed with bundled sample data.
      if (pois.length === 0 && cells.length === 0 && imports.length === 0) {
        await this.importDocuments([{ name: 'sample-data', json: defaultFixture }])
        this.loaded = true
        return
      }
      this.pois = markRaw(pois)
      this.cells = markRaw(cells)
      this.imports = imports
      this.loaded = true
      this.revision++
    },

    /** Replaces all tables in one transaction; clearing first avoids ConstraintError. */
    async importDocuments(docs: { name: string; json: unknown }[]): Promise<ImportSummary> {
      const now = Date.now()
      const parsed = docs.map((d) => ({ name: d.name, result: parseWayfarer(d.json) }))

      const incomings = parsed.map((p, i) => ({
        cells: p.result.cells,
        pois: p.result.pois,
        importTimestamp: now + i
      }))
      const merged = mergeMany(
        { cells: this.cells, pois: this.pois, importTimestamp: 0 },
        incomings
      )

      const records: ImportRecord[] = parsed.map((p, i) => ({
        id: `${now}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        fileName: p.name,
        importedAt: now,
        poiCount: p.result.pois.length,
        cellCount: p.result.cells.length,
        truncatedCount: p.result.cells.filter((c) => c.truncated).length,
        warningCount: p.result.warnings.length
      }))

      await db.transaction('rw', [db.pois, db.cells, db.imports], async () => {
        await db.pois.clear()
        await db.cells.clear()
        await db.pois.bulkPut(merged.pois)
        await db.cells.bulkPut(merged.cells)
        await db.imports.bulkAdd(records)
      })

      // Update state only after commit
      this.pois = markRaw(merged.pois)
      this.cells = markRaw(merged.cells)
      this.imports = [...records.reverse(), ...this.imports]
      this.revision++

      const allPois = parsed.flatMap((p) => p.result.pois)
      const allWarnings = parsed.flatMap((p) => p.result.warnings)
      const kinds = countByKind(allPois)
      const stats: MergeStats = merged.stats

      return {
        documents: docs.length,
        poisAdded: stats.poisAdded,
        poisUpdated: stats.poisUpdated,
        poisRemoved: stats.poisRemoved,
        poisUnchanged: stats.poisUnchanged,
        cellsAdded: stats.cellsAdded,
        cellsUpdated: stats.cellsUpdated,
        cellsSkippedOlder: stats.cellsSkippedOlder,
        warnings: allWarnings,
        poiCount: allPois.length,
        stopCount: kinds.stop,
        gymCount: kinds.gym,
        powerSpotCount: kinds.powerSpot,
        noGmoCount: kinds.noGmo,
        cellCount: parsed.reduce((n, p) => n + p.result.cells.length, 0),
        truncatedCount: parsed.reduce(
          (n, p) => n + p.result.cells.filter((c) => c.truncated).length,
          0
        ),
        warningCount: allWarnings.length
      }
    },

    async importFromJson(json: unknown, fileName: string): Promise<ImportSummary> {
      return this.importDocuments([{ name: fileName, json }])
    },

    async clearAll(): Promise<void> {
      await db.transaction('rw', db.pois, db.cells, db.imports, async () => {
        await db.pois.clear()
        await db.cells.clear()
        await db.imports.clear()
      })
      this.pois = markRaw([])
      this.cells = markRaw([])
      this.imports = []
      this.revision++
    }
  }
})
