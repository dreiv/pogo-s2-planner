// Thin wrapper over s2js. Degrees in/out; tokens are hex strings (Wayfarer format).
import { s2 } from 's2js'

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

export function cellTokenAt(lat: number, lng: number, level: number): string {
  const cid = cellIdAtLevel(lat, lng, level)
  return s2.cellid.toToken(cid)
}

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

export function cellCenter(token: string): [number, number] {
  const cid = tokenToCellId(token)
  const ll = s2.cellid.latLng(cid)
  return [toDeg(ll.lat), toDeg(ll.lng)]
}

export function parentToken(token: string, level: number): string {
  const cid = tokenToCellId(token)
  const parent = s2.cellid.parent(cid, level)
  return s2.cellid.toToken(parent)
}

export function childTokens(token: string): string[] {
  const cid = tokenToCellId(token)
  const children = s2.cellid.children(cid)
  return children.map((c: bigint) => s2.cellid.toToken(c))
}

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

/** Cells at `level` covering the bounds; truncated=true if capped at maxCells. */
export function cellsCoveringBounds(
  bounds: Bounds,
  level: number,
  maxCells: number
): CoveringResult {
  const latSpan = bounds.north - bounds.south
  const lngSpan = bounds.east - bounds.west
  const padLat = latSpan * 0.1
  const padLng = lngSpan * 0.1
  const south = toRad(bounds.south - padLat)
  const north = toRad(bounds.north + padLat)
  const west = toRad(bounds.west - padLng)
  const east = toRad(bounds.east + padLng)

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
