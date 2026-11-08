import { defaultSettings, validateSettings, type SettingsData } from './settings'
import type { ParsedCell, ParsedPoi } from './wayfarer/parse'

export const SCHEMA_VERSION = 1

export type MarkStatus = 'planificat' | 'propus' | 'in-review' | 'respins' | 'aprobat'

export interface ExportedMark {
  token17: string
  status: MarkStatus
  note: string
  updatedAt: number
}

export type ExportedSettings = SettingsData

export interface ExportedDataset {
  pois: unknown[]
  cells: unknown[]
}

export interface BackupFile {
  schemaVersion: number
  exportedAt: number
  marks: ExportedMark[]
  settings: ExportedSettings
  /** Only when "export with dataset" is chosen. */
  dataset?: ExportedDataset
}

export interface ImportResult {
  ok: boolean
  marks: ExportedMark[]
  settings: ExportedSettings
  dataset?: ExportedDataset
  error?: string
}

const VALID_STATUSES: Set<string> = new Set<MarkStatus>([
  'planificat',
  'propus',
  'in-review',
  'respins',
  'aprobat'
])

export function parseBackup(raw: unknown): ImportResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, marks: [], settings: defaultSettings(), error: 'Not a JSON object' }
  }

  const obj = raw as Record<string, unknown>

  if (typeof obj.schemaVersion !== 'number') {
    return { ok: false, marks: [], settings: defaultSettings(), error: 'Missing schemaVersion' }
  }
  if (obj.schemaVersion !== SCHEMA_VERSION) {
    return {
      ok: false,
      marks: [],
      settings: defaultSettings(),
      error: `Unknown schema version: ${obj.schemaVersion} (expected ${SCHEMA_VERSION})`
    }
  }

  const marks: ExportedMark[] = []
  if (Array.isArray(obj.marks)) {
    for (const m of obj.marks) {
      if (typeof m !== 'object' || m === null) continue
      const mark = m as Record<string, unknown>
      if (typeof mark.token17 !== 'string' || mark.token17.length === 0) continue
      if (typeof mark.status !== 'string' || !VALID_STATUSES.has(mark.status)) continue
      marks.push({
        token17: mark.token17,
        status: mark.status as MarkStatus,
        note: typeof mark.note === 'string' ? mark.note : '',
        updatedAt: typeof mark.updatedAt === 'number' ? mark.updatedAt : 0
      })
    }
  }

  const settings = validateSettings(obj.settings)

  let dataset: ExportedDataset | undefined
  if (obj.dataset && typeof obj.dataset === 'object' && !Array.isArray(obj.dataset)) {
    const ds = obj.dataset as Record<string, unknown>
    if (Array.isArray(ds.pois) && Array.isArray(ds.cells)) {
      dataset = { pois: ds.pois, cells: ds.cells }
    }
  }

  return { ok: true, marks, settings, dataset }
}

export function buildBackup(
  marks: ExportedMark[],
  settings: ExportedSettings,
  includeDataset?: ExportedDataset
): BackupFile {
  const file: BackupFile = {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    marks,
    settings
  }
  if (includeDataset) {
    file.dataset = includeDataset
  }
  return file
}

export interface SanitizedDataset {
  pois: ParsedPoi[]
  cells: ParsedCell[]
  droppedPois: number
  droppedCells: number
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function text(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function finite(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function sanitizePoi(raw: unknown): ParsedPoi | null {
  if (!isRecord(raw)) return null
  const id = text(raw.id).trim()
  const lat = finite(raw.lat)
  const lng = finite(raw.lng)
  if (!id || lat === null || lng === null) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  const game: ParsedPoi['game'] = []
  if (Array.isArray(raw.game)) {
    for (const g of raw.game) {
      if (!isRecord(g)) continue
      game.push({ entity: text(g.entity), status: text(g.status), brand: text(g.brand) })
    }
  }
  return {
    id,
    lat,
    lng,
    title: text(raw.title),
    description: text(raw.description),
    address: text(raw.address),
    imageUrl: text(raw.imageUrl),
    communityContributed: raw.communityContributed === true,
    game,
    cellToken: text(raw.cellToken)
  }
}

const TOKEN_RE = /^[0-9a-f]{1,16}$/

function sanitizeCell(raw: unknown): ParsedCell | null {
  if (!isRecord(raw)) return null
  const token = text(raw.token).trim().toLowerCase()
  if (!TOKEN_RE.test(token)) return null
  const count = finite(raw.count)
  return {
    token,
    count: count !== null && count >= 0 ? count : 0,
    truncated: raw.truncated === true,
    generatedTimestamp: finite(raw.generatedTimestamp),
    snapshot: finite(raw.snapshot),
    level: finite(raw.level)
  }
}

/**
 * Backup files are user-supplied: validate every POI/cell before it replaces the dataset.
 * Invalid entries are dropped and counted; duplicates (same id / token) keep the last one.
 */
export function sanitizeDataset(raw: ExportedDataset): SanitizedDataset {
  const pois = new Map<string, ParsedPoi>()
  const cells = new Map<string, ParsedCell>()
  let droppedPois = 0
  let droppedCells = 0
  for (const p of raw.pois) {
    const poi = sanitizePoi(p)
    if (poi) pois.set(poi.id, poi)
    else droppedPois++
  }
  for (const c of raw.cells) {
    const cell = sanitizeCell(c)
    if (cell) cells.set(cell.token, cell)
    else droppedCells++
  }
  return { pois: [...pois.values()], cells: [...cells.values()], droppedPois, droppedCells }
}
