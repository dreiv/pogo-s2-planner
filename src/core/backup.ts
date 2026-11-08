/**
 * Backup / export-import — pure, tested.
 * Versioned JSON schema for marks + settings (optionally + dataset).
 */

export const SCHEMA_VERSION = 1

export type MarkStatus = 'planificat' | 'propus' | 'in-review' | 'respins' | 'aprobat'

export interface ExportedMark {
  token17: string
  status: MarkStatus
  note: string
  updatedAt: number
}

export interface ExportedSettings {
  center: [number, number]
  zoom: number
  showS14: boolean
  showS17: boolean
  s14MinZoom: number
  s17MinZoom: number
  showPois: boolean
  showOtherPois: boolean
  stopGymOnly: boolean
  showRange: boolean
  rangeRadius: number
  rangeCenter: [number, number] | null
  showRangeRings: boolean
  showPoiImages: boolean
}

export interface ExportedDataset {
  pois: unknown[]
  cells: unknown[]
}

export interface BackupFile {
  schemaVersion: number
  exportedAt: number
  marks: ExportedMark[]
  settings: ExportedSettings
  /** Optional: included only when "export with dataset" is chosen. */
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

/**
 * Validate and parse a backup JSON. Returns structured result or error.
 */
export function parseBackup(raw: unknown): ImportResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, marks: [], settings: defaultSettings(), error: 'Not a JSON object' }
  }

  const obj = raw as Record<string, unknown>

  // Check schemaVersion
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

  // Validate marks
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

  // Validate settings
  const settings = validateSettings(obj.settings)

  // Optional dataset
  let dataset: ExportedDataset | undefined
  if (obj.dataset && typeof obj.dataset === 'object' && !Array.isArray(obj.dataset)) {
    const ds = obj.dataset as Record<string, unknown>
    if (Array.isArray(ds.pois) && Array.isArray(ds.cells)) {
      dataset = { pois: ds.pois, cells: ds.cells }
    }
  }

  return { ok: true, marks, settings, dataset }
}

function defaultSettings(): ExportedSettings {
  return {
    center: [45.7, 21.3],
    zoom: 13,
    showS14: false,
    showS17: false,
    s14MinZoom: 12,
    s17MinZoom: 16,
    showPois: true,
    showOtherPois: true,
    stopGymOnly: false,
    showRange: false,
    rangeRadius: 80,
    rangeCenter: null,
    showRangeRings: false,
    showPoiImages: true
  }
}

function validateSettings(raw: unknown): ExportedSettings {
  const def = defaultSettings()
  if (typeof raw !== 'object' || raw === null) return def
  const s = raw as Record<string, unknown>

  return {
    center:
      Array.isArray(s.center) &&
      s.center.length === 2 &&
      typeof s.center[0] === 'number' &&
      typeof s.center[1] === 'number'
        ? [s.center[0] as number, s.center[1] as number]
        : def.center,
    zoom: typeof s.zoom === 'number' ? s.zoom : def.zoom,
    showS14: typeof s.showS14 === 'boolean' ? s.showS14 : def.showS14,
    showS17: typeof s.showS17 === 'boolean' ? s.showS17 : def.showS17,
    s14MinZoom: typeof s.s14MinZoom === 'number' ? s.s14MinZoom : def.s14MinZoom,
    s17MinZoom: typeof s.s17MinZoom === 'number' ? s.s17MinZoom : def.s17MinZoom,
    showPois: typeof s.showPois === 'boolean' ? s.showPois : def.showPois,
    showOtherPois: typeof s.showOtherPois === 'boolean' ? s.showOtherPois : def.showOtherPois,
    stopGymOnly: typeof s.stopGymOnly === 'boolean' ? s.stopGymOnly : def.stopGymOnly,
    showRange: typeof s.showRange === 'boolean' ? s.showRange : def.showRange,
    rangeRadius: typeof s.rangeRadius === 'number' ? s.rangeRadius : def.rangeRadius,
    rangeCenter:
      Array.isArray(s.rangeCenter) &&
      s.rangeCenter.length === 2 &&
      typeof s.rangeCenter[0] === 'number' &&
      typeof s.rangeCenter[1] === 'number'
        ? [s.rangeCenter[0] as number, s.rangeCenter[1] as number]
        : null,
    showRangeRings: typeof s.showRangeRings === 'boolean' ? s.showRangeRings : def.showRangeRings,
    showPoiImages: typeof s.showPoiImages === 'boolean' ? s.showPoiImages : def.showPoiImages
  }
}

/**
 * Build a backup file object from marks and settings.
 */
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
