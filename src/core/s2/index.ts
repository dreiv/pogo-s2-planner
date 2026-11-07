/**
 * S2 cell adapter — thin wrapper over s2js.
 * All lat/lng in degrees. Tokens are hex strings (matching Wayfarer format).
 */
import { s2 } from 's2js'

// --- Internal helpers ---

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI
}

function latLngToPoint(latRad: number, lngRad: number): s2.Point {
  return new s2.Point(
    Math.cos(latRad) * Math.cos(lngRad),
    Math.cos(latRad) * Math.sin(lngRad),
    Math.sin(latRad)
  )
}

function pointToLatLngDeg(point: s2.Point): [number, number] {
  const ll = s2.LatLng.fromPoint(point)
  return [toDeg(ll.lat), toDeg(ll.lng)]
}

function cellIdFromLatLngDeg(lat: number, lng: number): bigint {
  const ll = new s2.LatLng(toRad(lat), toRad(lng))
  return s2.cellid.fromLatLng(ll)
}

function cellIdAtLevel(lat: number, lng: number, level: number): bigint {
  const cid30 = cellIdFromLatLngDeg(lat, lng)
  return s2.cellid.parent(cid30, level)
}

function tokenToCellId(token: string): bigint {
  return s2.cellid.fromToken(token)
}

// --- Public API ---

/** Get the S2 cell token at the given lat/lng (degrees) and level. */
export function cellTokenAt(lat: number, lng: number, level: number): string {
  const cid = cellIdAtLevel(lat, lng, level)
  return s2.cellid.toToken(cid)
}

/** Get the 4 vertex coordinates [lat, lng] (degrees) of a cell. */
export function cellVertices(token: string): [number, number][] {
  const cid = tokenToCellId(token)
  const cell = s2.Cell.fromCellID(cid)
  const verts: [number, number][] = []
  for (let i = 0; i < 4; i++) {
    const v = cell.vertex(i)
    verts.push(pointToLatLngDeg(v))
  }
  return verts
}

/** Get the center [lat, lng] (degrees) of a cell. */
export function cellCenter(token: string): [number, number] {
  const cid = tokenToCellId(token)
  const ll = s2.cellid.latLng(cid)
  return [toDeg(ll.lat), toDeg(ll.lng)]
}

/** Get the parent token at the given level. */
export function parentToken(token: string, level: number): string {
  const cid = tokenToCellId(token)
  const parent = s2.cellid.parent(cid, level)
  return s2.cellid.toToken(parent)
}

/**
 * Get all child tokens one level below.
 * For S14 → returns 4 tokens at S15.
 * To get all 64 S17 children of an S14, call this 3 times recursively.
 */
export function childTokens(token: string): string[] {
  const cid = tokenToCellId(token)
  const children = s2.cellid.children(cid)
  return children.map((c: bigint) => s2.cellid.toToken(c))
}

/**
 * Get all descendant tokens at a target level (must be > cell level).
 * e.g. allS17Children(s14Token) → 64 tokens.
 */
export function allDescendantTokens(token: string, targetLevel: number): string[] {
  const cid = tokenToCellId(token)
  const currentLevel = s2.cellid.level(cid)
  if (targetLevel <= currentLevel) return []

  let current: bigint[] = [cid]
  for (let lvl = currentLevel; lvl < targetLevel; lvl++) {
    const next: bigint[] = []
    for (const c of current) {
      const children = s2.cellid.children(c)
      next.push(...children)
    }
    current = next
  }
  return current.map((c) => s2.cellid.toToken(c))
}

/** Get the level of a cell token. */
export function cellLevel(token: string): number {
  const cid = tokenToCellId(token)
  return s2.cellid.level(cid)
}

export interface Bounds {
  south: number
  west: number
  north: number
  east: number
}

export interface CoveringResult {
  tokens: string[]
  truncated: boolean
}

/**
 * Get all cell tokens at the given level that cover the bounding box.
 * Uses s2js RegionCoverer with minLevel/maxLevel = level.
 * Returns truncated=true if the result was capped at maxCells.
 */
export function cellsCoveringBounds(
  bounds: Bounds,
  level: number,
  maxCells: number
): CoveringResult {
  // 10% padding on each side of the bounds
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const padLat = latSpan * 0.1
  const padLng = lngSpan * 0.1
  const south = toRad(bounds.south - padLat)
  const north = toRad(bounds.north + padLat)
  const west = toRad(bounds.west - padLng)
  const east = toRad(bounds.east + padLng)

  // Create a loop (polygon) from the 4 corners
  const loop = new s2.Loop([
    latLngToPoint(south, west),
    latLngToPoint(south, east),
    latLngToPoint(north, east),
    latLngToPoint(north, west)
  ])

  const coverer = new s2.RegionCoverer({
    maxCells,
    minLevel: level,
    maxLevel: level
  })

  const covering = coverer.covering(loop) as bigint[]

  // RegionCoverer's maxCells is a hint, not a hard cap. Enforce it manually.
  const truncated = covering.length > maxCells
  const capped = truncated ? covering.slice(0, maxCells) : covering
  const tokens = capped.map((cid) => s2.cellid.toToken(cid))

  return { tokens, truncated }
}
