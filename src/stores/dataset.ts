import { defineStore } from 'pinia'
import { markRaw } from 'vue'
import { db, type ImportRecord } from '../data/db'
import { parseWayfarer, type ParsedCell, type ParsedPoi } from '../core/wayfarer/parse'
import { mergeMany, type MergeStats } from '../core/wayfarer/merge'
import { DEFAULT_CLASSIFY_OPTS, poiKind, type CellState } from '../core/classify'
import { buildCoverage, createCellStateResolver } from '../core/cellState'
import { buildPoiIndex, type PoiIndex } from '../core/poiIndex'
import { parentToken } from '../core/s2'
import { sanitizeDataset } from '../core/backup'
import { loadInitialDataset } from '../data/initialData'

export interface ImportSummary {
  documents: number
  poisAdded: number
  poisUpdated: number
  poisRemoved: number
  poisUnchanged: number
  cellsAdded: number
  cellsUpdated: number
  cellsSkippedOlder: number
  /** Cells whose declared level is not S14: this planner only colors S14 exports. */
  nonS14Cells: number
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
  /** Set when reading IndexedDB failed; the app then runs with an empty in-memory dataset. */
  loadError: string | null
  /** Set when a write to IndexedDB failed; the change exists in memory only until reload. */
  storageError: string | null
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err)
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
    revision: 0,
    loadError: null,
    storageError: null
  }),

  getters: {
    /** Shared, memoized index (rebuilt only when the dataset changes). */
    poiIndex(state): PoiIndex {
      void state.revision
      return markRaw(buildPoiIndex(state.pois))
    },
    /** Shared S17 state lookup used by the map and the side panel. */
    cellStateResolver(state): (token17: string) => CellState {
      void state.revision
      return markRaw(
        createCellStateResolver({
          poisByS17: this.poiIndex.poisByS17,
          coverage: buildCoverage(state.cells),
          opts: DEFAULT_CLASSIFY_OPTS,
          parentOf: (token17) => parentToken(token17, 14)
        })
      )
    }
  },

  actions: {
    async load(): Promise<void> {
      if (this.loaded) return
      try {
        const [pois, cells, imports] = await Promise.all([
          db.pois.toArray(),
          db.cells.toArray(),
          db.imports.orderBy('importedAt').reverse().toArray()
        ])
        this.pois = markRaw(pois)
        this.cells = markRaw(cells)
        this.imports = imports
        this.loadError = null
      } catch (err) {
        // IndexedDB unavailable or blocked (private mode, storage policy, corrupt DB).
        console.error('Could not read the local database:', err)
        this.loadError = errorMessage(err)
      }
      this.loaded = true
      this.revision++

      // Empty database (first open, or after "Delete all" + reload): pre-populate the map with the
      // bundled initial dataset, so a fresh visitor sees data right away.
      if (this.pois.length === 0 && this.cells.length === 0) {
        await this.seedInitialData()
      }
    },

    /**
     * Fills the empty dataset with the bundled initial one. If the database could not be read
     * (`loadError`), the seed is shown from memory only and nothing is written, so a transient
     * read failure can never overwrite data that is really stored. Failures are only logged.
     */
    async seedInitialData(): Promise<void> {
      try {
        const raw = await loadInitialDataset()
        if (!raw) return
        const seed = sanitizeDataset(raw)
        if (this.loadError) {
          this.pois = markRaw(seed.pois)
          this.cells = markRaw(seed.cells)
          this.revision++
        } else {
          await this.replaceAll(seed.pois, seed.cells, 'initial data')
        }
      } catch (err) {
        console.error('Could not load the initial data:', err)
      }
    },

    /**
     * Writes the dataset in one transaction. A failure (quota, blocked DB) is recorded in
     * `storageError` instead of being swallowed or discarding the in-memory change.
     */
    async persistDataset(
      pois: ParsedPoi[],
      cells: ParsedCell[],
      imports: { clear: boolean; add: ImportRecord[] }
    ): Promise<void> {
      try {
        await db.transaction('rw', [db.pois, db.cells, db.imports], async () => {
          await db.pois.clear()
          await db.cells.clear()
          await db.pois.bulkPut(pois)
          await db.cells.bulkPut(cells)
          if (imports.clear) await db.imports.clear()
          if (imports.add.length > 0) await db.imports.bulkAdd(imports.add)
        })
        this.storageError = null
      } catch (err) {
        console.error('Could not save to the local database:', err)
        this.storageError = errorMessage(err)
      }
    },

    /**
     * Replaces the whole dataset (backup restore). Input must already be validated
     * (see `sanitizeDataset`); import history is reset to a single restore record.
     */
    async replaceAll(pois: ParsedPoi[], cells: ParsedCell[], label: string): Promise<void> {
      const record: ImportRecord = {
        id: `${Date.now()}-restore-${Math.random().toString(36).slice(2, 8)}`,
        fileName: label,
        importedAt: Date.now(),
        poiCount: pois.length,
        cellCount: cells.length,
        truncatedCount: cells.filter((c) => c.truncated).length,
        warningCount: 0
      }
      await this.persistDataset(pois, cells, { clear: true, add: [record] })
      this.pois = markRaw(pois)
      this.cells = markRaw(cells)
      this.imports = [record]
      this.revision++
    },

    /** Merges the documents into the dataset and rewrites the tables in one transaction. */
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

      // Existing import records stay; only the new ones are added.
      await this.persistDataset(merged.pois, merged.cells, { clear: false, add: records })

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
        nonS14Cells: parsed.reduce(
          (n, p) => n + p.result.cells.filter((c) => c.level !== null && c.level !== 14).length,
          0
        ),
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
      try {
        await db.transaction('rw', db.pois, db.cells, db.imports, async () => {
          await db.pois.clear()
          await db.cells.clear()
          await db.imports.clear()
        })
        this.storageError = null
      } catch (err) {
        console.error('Could not clear the local database:', err)
        this.storageError = errorMessage(err)
      }
      this.pois = markRaw([])
      this.cells = markRaw([])
      this.imports = []
      this.revision++
    }
  }
})
