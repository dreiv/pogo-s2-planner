/**
 * Dexie database for Wayfarer data persistence.
 * Only this file imports dexie.
 */
import Dexie from 'dexie'
import type { ParsedCell, ParsedPoi } from '../core/wayfarer/parse'

export interface ImportRecord {
  id: string
  fileName: string
  importedAt: number
  poiCount: number
  cellCount: number
  truncatedCount: number
  warningCount: number
}

export type MarkStatus = 'planificat' | 'propus' | 'in-review' | 'respins' | 'aprobat'

export interface CellMark {
  token17: string
  status: MarkStatus
  note: string
  updatedAt: number
}

class PogoDb extends Dexie {
  pois!: Dexie.Table<ParsedPoi & { id: string }, string>
  cells!: Dexie.Table<ParsedCell & { token: string }, string>
  imports!: Dexie.Table<ImportRecord, string>
  marks!: Dexie.Table<CellMark, string>

  constructor() {
    super('pogo-s2-planner')
    this.version(1).stores({
      pois: 'id, cellToken',
      cells: 'token',
      imports: 'id, importedAt'
    })
    this.version(2).stores({
      marks: 'token17'
    })
  }
}

export const db = new PogoDb()
