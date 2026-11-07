/**
 * Dataset store — loads Wayfarer data from IndexedDB, handles import/clear.
 */
import { defineStore } from 'pinia'
import { db, type ImportRecord } from '../data/db'
import { parseWayfarer, type ParsedCell, type ParsedPoi } from '../core/wayfarer/parse'
import { mergeImports } from '../core/wayfarer/merge'

export interface ImportSummary {
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
    if (poi.game.length === 0) {
      noGmo++
      continue
    }
    const active = poi.game.filter((g) => g.status === 'ACTIVE')
    if (active.length === 0) {
      noGmo++
      continue
    }
    const brands = new Set(active.map((g) => g.entity))
    if (brands.has('POKESTOP')) stop++
    else if (brands.has('GYM')) gym++
    else if (brands.has('POWERSPOT')) powerSpot++
    else noGmo++
  }
  return { stop, gym, powerSpot, noGmo }
}

export const useDatasetStore = defineStore('dataset', {
  state: (): DatasetState => ({
    pois: [],
    cells: [],
    imports: [],
    loaded: false
  }),

  actions: {
    async load(): Promise<void> {
      if (this.loaded) return
      const [pois, cells, imports] = await Promise.all([
        db.pois.toArray(),
        db.cells.toArray(),
        db.imports.orderBy('importedAt').reverse().toArray()
      ])
      this.pois = pois
      this.cells = cells
      this.imports = imports
      this.loaded = true
    },

    async importFromJson(json: unknown, fileName: string): Promise<ImportSummary> {
      const parsed = parseWayfarer(json)
      const now = Date.now()
      const importId = `${now}-${Math.random().toString(36).slice(2, 8)}`

      // Merge with existing data
      const merged = mergeImports(
        { cells: this.cells, pois: this.pois, importTimestamp: now - 1 },
        { cells: parsed.cells, pois: parsed.pois, importTimestamp: now }
      )

      const record: ImportRecord = {
        id: importId,
        fileName,
        importedAt: now,
        poiCount: parsed.pois.length,
        cellCount: parsed.cells.length,
        truncatedCount: parsed.cells.filter((c) => c.truncated).length,
        warningCount: parsed.warnings.length
      }

      // Persist
      await db.transaction('rw', [db.pois, db.cells, db.imports], async () => {
        await db.pois.bulkPut(merged.pois)
        await db.cells.bulkPut(merged.cells)
        await db.imports.add(record)
      })

      // Update state
      this.pois = merged.pois
      this.cells = merged.cells
      this.imports.unshift(record)

      const kinds = countByKind(parsed.pois)
      return {
        poiCount: parsed.pois.length,
        stopCount: kinds.stop,
        gymCount: kinds.gym,
        powerSpotCount: kinds.powerSpot,
        noGmoCount: kinds.noGmo,
        cellCount: parsed.cells.length,
        truncatedCount: parsed.cells.filter((c) => c.truncated).length,
        warningCount: parsed.warnings.length
      }
    },

    async clearAll(): Promise<void> {
      await db.transaction('rw', [db.pois, db.cells, db.imports], async () => {
        await db.pois.clear()
        await db.cells.clear()
        await db.imports.clear()
      })
      this.pois = []
      this.cells = []
      this.imports = []
    }
  }
})
