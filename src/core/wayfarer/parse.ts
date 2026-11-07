/**
 * Wayfarer export parser — tolerant, no dependencies.
 * Accepts: full response ({result:{data:[...]}}), just result ({data:[...]}),
 * or the direct array of cells.
 */

// --- Output types ---

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
  imageUrl: string
  communityContributed: boolean
  game: ParsedGameObject[]
  cellToken: string
}

export interface ParsedCell {
  token: string
  count: number
  truncated: boolean
  generatedTimestamp: number | null
  snapshot: number | null
  level: number | null
}

export interface ParseResult {
  cells: ParsedCell[]
  pois: ParsedPoi[]
  warnings: string[]
}

// --- Type guards (hand-written, no dependencies) ---

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean'
}

// --- Internal raw types (what the JSON actually looks like) ---

interface RawGmo {
  entity?: unknown
  status?: unknown
  brand?: unknown
}

interface RawPoi {
  poiId?: unknown
  latE6?: unknown
  lngE6?: unknown
  title?: unknown
  description?: unknown
  address?: unknown
  imageUrl?: unknown
  isCommunityContributed?: unknown
  gmo?: unknown
}

interface RawMetadata {
  s2CellId?: unknown
  count?: unknown
  s2CellLevel?: unknown
  generatedTimestamp?: unknown
  snapshot?: unknown
}

interface RawCell {
  metadata?: unknown
  pois?: unknown
}

// --- Parser ---

/**
 * Parse a Wayfarer export. Accepts the full API response, just the `result`
 * object, or the bare array of cells. Returns structured data + warnings.
 * Never throws — invalid fields produce warnings.
 */
export function parseWayfarer(input: unknown): ParseResult {
  const warnings: string[] = []
  let cellsRaw: RawCell[]

  // Unwrap: {result:{data:[...]}} → {data:[...]} → [...]
  if (isRecord(input) && isRecord(input.result)) {
    const result = input.result as Record<string, unknown>
    if (Array.isArray(result.data)) {
      cellsRaw = result.data as RawCell[]
    } else {
      warnings.push('result.data is not an array — no cells found')
      return { cells: [], pois: [], warnings }
    }
  } else if (isRecord(input) && Array.isArray(input.data)) {
    cellsRaw = input.data as RawCell[]
  } else if (Array.isArray(input)) {
    cellsRaw = input as RawCell[]
  } else {
    warnings.push(
      'Unrecognized input format — expected {result:{data:[...]}}, {data:[...]}, or [...]'
    )
    return { cells: [], pois: [], warnings }
  }

  const cells: ParsedCell[] = []
  const pois: ParsedPoi[] = []

  for (let ci = 0; ci < cellsRaw.length; ci++) {
    const rawCell = cellsRaw[ci]
    if (!isRecord(rawCell)) {
      warnings.push(`Cell ${ci}: not an object, skipped`)
      continue
    }

    // --- metadata ---
    let count = 0
    let level: number | null = null
    let generatedTimestamp: number | null = null
    let snapshot: number | null = null
    let token: string

    if (isRecord(rawCell.metadata)) {
      const meta = rawCell.metadata as RawMetadata
      if (isString(meta.s2CellId)) {
        token = meta.s2CellId
      } else {
        warnings.push(`Cell ${ci}: missing or invalid metadata.s2CellId, skipped`)
        continue
      }
      if (isNumber(meta.count)) {
        count = meta.count
      }
      if (isNumber(meta.s2CellLevel)) {
        level = meta.s2CellLevel
      }
      if (isNumber(meta.generatedTimestamp)) {
        generatedTimestamp = meta.generatedTimestamp
      }
      if (isNumber(meta.snapshot)) {
        snapshot = meta.snapshot
      }
    } else {
      warnings.push(`Cell ${ci}: missing metadata, skipped`)
      continue
    }

    cells.push({
      token,
      count,
      truncated: count >= 50,
      generatedTimestamp,
      snapshot,
      level
    })

    // --- pois ---
    const rawPois = rawCell.pois
    if (!Array.isArray(rawPois)) {
      continue // no pois, that's fine
    }

    for (let pi = 0; pi < rawPois.length; pi++) {
      const rawPoi = rawPois[pi]
      if (!isRecord(rawPoi)) {
        warnings.push(`Cell ${ci}, POI ${pi}: not an object, skipped`)
        continue
      }

      const rp = rawPoi as RawPoi

      // id
      if (!isString(rp.poiId) || rp.poiId.length === 0) {
        warnings.push(`Cell ${ci}, POI ${pi}: missing poiId, skipped`)
        continue
      }

      // coordinates
      if (!isNumber(rp.latE6) || !isNumber(rp.lngE6)) {
        warnings.push(`Cell ${ci}, POI ${pi} (${rp.poiId}): missing coordinates, skipped`)
        continue
      }

      // gmo
      const game: ParsedGameObject[] = []
      if (Array.isArray(rp.gmo)) {
        for (const g of rp.gmo) {
          if (isRecord(g)) {
            const rg = g as RawGmo
            game.push({
              entity: isString(rg.entity) ? rg.entity : '',
              status: isString(rg.status) ? rg.status : '',
              brand: isString(rg.brand) ? rg.brand : ''
            })
          }
        }
      }

      pois.push({
        id: rp.poiId,
        lat: rp.latE6 / 1e6,
        lng: rp.lngE6 / 1e6,
        title: isString(rp.title) ? rp.title : '',
        description: isString(rp.description) ? rp.description : '',
        address: isString(rp.address) ? rp.address : '',
        imageUrl: isString(rp.imageUrl) ? rp.imageUrl : '',
        communityContributed: isBoolean(rp.isCommunityContributed)
          ? rp.isCommunityContributed
          : false,
        game,
        cellToken: token
      })
    }
  }

  return { cells, pois, warnings }
}
