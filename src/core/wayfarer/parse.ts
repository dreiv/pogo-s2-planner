/**
 * Wayfarer export parser — tolerant, no dependencies.
 *
 * Accepts: the full API response ({result:{data:[...]}}), just `result`
 * ({data:[...]}), or the bare array of cells.
 *
 * Real export shape (verified against a real response, Nov 2026):
 *  - Cells with data:  { metadata: { s2CellId, s2CellLevel, count, generatedTimestamp (string, ms) }, pois, cellId }
 *  - Cells with NO POIs: { cellId, pois: [] } — NO `metadata` at all. They still mean
 *    "this S14 cell was queried and is empty" => every S17 inside is free.
 *  - `snapshot` ("YYYY-MM-DD") and `cellLevel` live on `result`, not on each cell.
 *  - POI image is `mainImage`; the game brand is `gmo[].gameBrand` (value "HOLOHOLO").
 *
 * Legacy names (`imageUrl`, `gmo[].brand`) are still accepted so old fixtures/backups work.
 * Never throws: invalid pieces produce warnings.
 */

/** A cell with count >= this value may have been cut off by the API. */
export const TRUNCATION_THRESHOLD = 50

// --- Output types (unchanged public shape) ---

export interface ParsedGameObject {
  entity: string
  status: string
  brand: string
}

export interface ParsedPoi {
  id: string
  lat: number
  lng: number
  title: string
  description: string
  address: string
  /** Raw `mainImage` URL as exported. Sanitize with `stablePoiImageUrl` before display. */
  imageUrl: string
  communityContributed: boolean
  game: ParsedGameObject[]
  cellToken: string
}

export interface ParsedCell {
  token: string
  count: number
  truncated: boolean
  /** Epoch milliseconds (as exported), or null when unknown. */
  generatedTimestamp: number | null
  /** Epoch milliseconds of the snapshot date, or null when unknown. */
  snapshot: number | null
  level: number | null
}

export interface ParseResult {
  cells: ParsedCell[]
  pois: ParsedPoi[]
  warnings: string[]
}

// --- Type guards / coercion (hand-written, no dependencies) ---

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** number or numeric string -> number; anything else -> null. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** number | numeric string | date string ("2026-11-06") -> epoch value; else null. */
function toMillis(v: unknown): number | null {
  const n = num(v)
  if (n !== null) return n
  if (typeof v === 'string') {
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }
  return null
}

// --- Unwrap ---

interface Unwrapped {
  data: unknown[] | null
  snapshot: unknown
  cellLevel: unknown
}

function unwrap(input: unknown): Unwrapped {
  if (Array.isArray(input)) return { data: input, snapshot: undefined, cellLevel: undefined }
  if (!isRecord(input)) return { data: null, snapshot: undefined, cellLevel: undefined }
  const root = isRecord(input.result) ? input.result : input
  return {
    data: Array.isArray(root.data) ? root.data : null,
    snapshot: root.snapshot,
    cellLevel: root.cellLevel
  }
}

// --- POI ---

function parsePoi(
  raw: unknown,
  cellToken: string,
  label: string,
  warnings: string[]
): ParsedPoi | null {
  if (!isRecord(raw)) {
    warnings.push(`${label}: POI is not an object, skipped.`)
    return null
  }
  const id = str(raw.poiId).trim()
  if (!id) {
    warnings.push(`${label}: POI without poiId, skipped.`)
    return null
  }
  const latE6 = num(raw.latE6)
  const lngE6 = num(raw.lngE6)
  if (latE6 === null || lngE6 === null) {
    warnings.push(`${label} (${id}): POI without valid latE6/lngE6, skipped.`)
    return null
  }
  const lat = latE6 / 1e6
  const lng = lngE6 / 1e6
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    warnings.push(`${label} (${id}): coordinates out of range, skipped.`)
    return null
  }

  const game: ParsedGameObject[] = []
  if (Array.isArray(raw.gmo)) {
    for (const g of raw.gmo) {
      if (!isRecord(g)) continue
      game.push({
        entity: str(g.entity).trim(),
        status: str(g.status).trim(),
        // Real exports use `gameBrand`; `brand` is the legacy/invented name.
        brand: (str(g.gameBrand) || str(g.brand)).trim()
      })
    }
  }

  return {
    id,
    lat,
    lng,
    title: str(raw.title),
    description: str(raw.description),
    address: str(raw.address),
    // Real exports use `mainImage`; `imageUrl` is the legacy/invented name.
    imageUrl: str(raw.mainImage) || str(raw.imageUrl),
    communityContributed: raw.isCommunityContributed === true,
    game,
    cellToken
  }
}

// --- Parser ---

export function parseWayfarer(input: unknown): ParseResult {
  const warnings: string[] = []
  const { data, snapshot, cellLevel } = unwrap(input)

  if (!data) {
    warnings.push('No cell array found (expected result.data[], data[] or a bare array).')
    return { cells: [], pois: [], warnings }
  }

  const rootSnapshot = toMillis(snapshot)
  const rootLevel = num(cellLevel)
  const cells = new Map<string, ParsedCell>()
  const pois = new Map<string, ParsedPoi>()
  let duplicatePois = 0

  data.forEach((raw, index) => {
    if (!isRecord(raw)) {
      warnings.push(`Cell #${index}: not an object, skipped.`)
      return
    }
    const meta = isRecord(raw.metadata) ? raw.metadata : {}
    // Cells without metadata (empty cells) only have the top-level `cellId`.
    const token = (str(meta.s2CellId) || str(raw.cellId)).trim().toLowerCase()
    if (!token) {
      warnings.push(`Cell #${index}: no s2CellId/cellId, skipped.`)
      return
    }

    const rawPois = Array.isArray(raw.pois) ? raw.pois : []
    let valid = 0
    rawPois.forEach((p, i) => {
      const poi = parsePoi(p, token, `${token}[${i}]`, warnings)
      if (!poi) return
      valid++
      if (pois.has(poi.id)) duplicatePois++
      pois.set(poi.id, poi)
    })

    const count = Math.max(num(meta.count) ?? 0, valid)
    const cell: ParsedCell = {
      token,
      count,
      truncated: count >= TRUNCATION_THRESHOLD,
      generatedTimestamp: toMillis(meta.generatedTimestamp),
      snapshot: toMillis(meta.snapshot) ?? rootSnapshot,
      level: num(meta.s2CellLevel) ?? rootLevel
    }
    const prev = cells.get(token)
    if (!prev || (cell.generatedTimestamp ?? 0) >= (prev.generatedTimestamp ?? 0)) {
      cells.set(token, cell)
    }
  })

  if (duplicatePois > 0) {
    warnings.push(`${duplicatePois} duplicate poiId(s) in the same import; last one kept.`)
  }

  return { cells: [...cells.values()], pois: [...pois.values()], warnings }
}
