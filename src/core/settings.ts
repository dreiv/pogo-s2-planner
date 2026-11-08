// Pure settings model: defaults, validation/clamping and versioned migrations.
// Shared by the settings store (localStorage) and the backup importer, so a bad value
// (hand-edited storage, old backup, truncated file) can never reach the map code.

/** Bump when the persisted shape or the meaning of a stored value changes; add a migration. */
export const SETTINGS_VERSION = 2

export const DEFAULT_CENTER: [number, number] = [45.7649, 21.2531]
export const DEFAULT_ZOOM = 13

export const ZOOM_MIN = 1
export const ZOOM_MAX = 19
export const RANGE_RADIUS_MIN = 20
export const RANGE_RADIUS_MAX = 500

/** Mark statuses, mirrored here because `core` cannot import from `data` (a test keeps them in sync). */
export const MARK_STATUS_IDS = ['planificat', 'propus', 'in-review', 'respins', 'aprobat'] as const
export type MarkStatusId = (typeof MARK_STATUS_IDS)[number]

export interface SettingsData {
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
  showPoiImages: boolean
  /** Which S17 cell states are tinted on the map (grid itself is controlled by showS17). */
  showCellOccupied: boolean
  showCellUncertain: boolean
  showCellFree: boolean
  showCellUnknown: boolean
  /** Mark statuses whose outline is hidden on the map (the marks themselves are kept). */
  hiddenMarkStatuses: MarkStatusId[]
}

export function defaultSettings(): SettingsData {
  return {
    center: [DEFAULT_CENTER[0], DEFAULT_CENTER[1]],
    zoom: DEFAULT_ZOOM,
    showS14: false,
    showS17: false,
    s14MinZoom: 13,
    s17MinZoom: 16,
    showPois: true,
    showOtherPois: true,
    stopGymOnly: false,
    showRange: false,
    rangeRadius: 80,
    rangeCenter: null,
    showPoiImages: true,
    showCellOccupied: true,
    showCellUncertain: true,
    // Free cells stay untinted by default (a whole city of green is noisy); opt-in in the legend.
    showCellFree: false,
    showCellUnknown: true,
    hiddenMarkStatuses: []
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function clampedNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = finiteNumber(v)
  return n === null ? fallback : clamp(n, min, max)
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** Keeps only known statuses, de-duplicated and in canonical order. */
function markStatusList(v: unknown): MarkStatusId[] {
  if (!Array.isArray(v)) return []
  return MARK_STATUS_IDS.filter((id) => v.includes(id))
}

function latLng(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null
  const lat = finiteNumber(v[0])
  const lng = finiteNumber(v[1])
  if (lat === null || lng === null) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return [lat, lng]
}

export function clampRangeRadius(radius: number): number {
  return clampedNumber(radius, RANGE_RADIUS_MIN, RANGE_RADIUS_MAX, defaultSettings().rangeRadius)
}

export function clampZoom(zoom: number, fallback: number = DEFAULT_ZOOM): number {
  return clampedNumber(zoom, ZOOM_MIN, ZOOM_MAX, fallback)
}

/** Field-by-field validation: anything missing or invalid falls back to the default. */
export function validateSettings(raw: unknown): SettingsData {
  const def = defaultSettings()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return def
  const s = raw as Record<string, unknown>
  return {
    center: latLng(s.center) ?? def.center,
    zoom: clampedNumber(s.zoom, ZOOM_MIN, ZOOM_MAX, def.zoom),
    showS14: bool(s.showS14, def.showS14),
    showS17: bool(s.showS17, def.showS17),
    s14MinZoom: clampedNumber(s.s14MinZoom, ZOOM_MIN, ZOOM_MAX, def.s14MinZoom),
    s17MinZoom: clampedNumber(s.s17MinZoom, ZOOM_MIN, ZOOM_MAX, def.s17MinZoom),
    showPois: bool(s.showPois, def.showPois),
    showOtherPois: bool(s.showOtherPois, def.showOtherPois),
    stopGymOnly: bool(s.stopGymOnly, def.stopGymOnly),
    showRange: bool(s.showRange, def.showRange),
    rangeRadius: clampedNumber(s.rangeRadius, RANGE_RADIUS_MIN, RANGE_RADIUS_MAX, def.rangeRadius),
    rangeCenter: latLng(s.rangeCenter),
    showPoiImages: bool(s.showPoiImages, def.showPoiImages),
    showCellOccupied: bool(s.showCellOccupied, def.showCellOccupied),
    showCellUncertain: bool(s.showCellUncertain, def.showCellUncertain),
    showCellFree: bool(s.showCellFree, def.showCellFree),
    showCellUnknown: bool(s.showCellUnknown, def.showCellUnknown),
    hiddenMarkStatuses: markStatusList(s.hiddenMarkStatuses)
  }
}

type Migration = (stored: Record<string, unknown>) => Record<string, unknown>

/**
 * MIGRATIONS[n] upgrades a version-n object to version n+1.
 * v1 -> v2: builds before v2 persisted every value, so a stored minimum zoom equal to a
 * retired default was indistinguishable from a deliberate choice and pinned users to it.
 * Drop those two values so the current defaults apply; custom values are kept.
 */
const MIGRATIONS: Record<number, Migration> = {
  1: (stored) => {
    const next = { ...stored }
    if (next.s14MinZoom === 12) delete next.s14MinZoom
    return next
  }
}

/** Parses the persisted JSON string (or null) into validated settings; never throws. */
export function parseStoredSettings(json: string | null): SettingsData {
  if (!json) return defaultSettings()
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return defaultSettings()
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return defaultSettings()
  }
  let obj = parsed as Record<string, unknown>
  // Files written before versioning have no `version`: treat them as v1.
  let version = finiteNumber(obj.version) ?? 1
  if (version > SETTINGS_VERSION) {
    // Written by a newer build: keep what still validates, do not downgrade-migrate.
    return validateSettings(obj)
  }
  while (version < SETTINGS_VERSION) {
    const migrate = MIGRATIONS[version]
    if (migrate) obj = migrate(obj)
    version++
  }
  return validateSettings(obj)
}

export function serializeSettings(settings: SettingsData): string {
  return JSON.stringify({ version: SETTINGS_VERSION, ...settings })
}
