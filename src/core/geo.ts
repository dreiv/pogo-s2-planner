/**
 * Geometric utilities — pure, tested.
 * Haversine distance, point-to-polygon distance (local equirectangular),
 * POI filtering by radius, cell-circle intersection.
 */
import { cellVertices, cellCenter, cellsCoveringBounds, type Bounds } from './s2'
import type { ParsedPoi } from './wayfarer/parse'

const EARTH_RADIUS_M = 6371000

/**
 * Haversine distance in meters between two lat/lng points.
 */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/**
 * Local equirectangular projection: converts lat/lng to approximate x/y in meters
 * relative to a reference point. Valid for small areas (< ~10 km).
 */
export function projectLocal(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number
): [number, number] {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const x = toRad(lng - refLng) * Math.cos(toRad((lat + refLat) / 2)) * EARTH_RADIUS_M
  const y = toRad(lat - refLat) * EARTH_RADIUS_M
  return [x, y]
}

/**
 * Distance from a point to a polygon (local equirectangular approximation).
 * Returns 0 if the point is inside the polygon.
 */
export function pointToPolygonDistance(
  pointLat: number,
  pointLng: number,
  polygon: [number, number][]
): number {
  if (polygon.length < 3) return 0

  const [px, py] = projectLocal(pointLat, pointLng, polygon[0]![0], polygon[0]![1])

  // Check if point is inside polygon (ray casting)
  if (pointInPolygon(px, py, polygon, polygon[0]![0], polygon[0]![1])) {
    return 0
  }

  // Find minimum distance to any edge
  let minDist = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const [lat1, lng1] = polygon[i]!
    const [lat2, lng2] = polygon[(i + 1) % polygon.length]!
    const [x1, y1] = projectLocal(lat1, lng1, polygon[0]![0], polygon[0]![1])
    const [x2, y2] = projectLocal(lat2, lng2, polygon[0]![0], polygon[0]![1])
    const dist = pointToSegmentDist(px, py, x1, y1, x2, y2)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

function pointInPolygon(
  px: number,
  py: number,
  polygon: [number, number][],
  refLat: number,
  refLng: number
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lat1, lng1] = polygon[i]!
    const [lat2, lng2] = polygon[j]!
    const [x1, y1] = projectLocal(lat1, lng1, refLat, refLng)
    const [x2, y2] = projectLocal(lat2, lng2, refLat, refLng)
    if (y1 > py !== y2 > py && px < ((x2 - x1) * (py - y1)) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

function pointToSegmentDist(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(px - x1, py - y1)
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = x1 + t * dx
  const projY = y1 + t * dy
  return Math.hypot(px - projX, py - projY)
}

export interface PoiWithDistance {
  poi: ParsedPoi
  distance: number
}

/**
 * Filter POIs within a radius (meters) of a center point.
 * Returns POIs sorted by distance.
 */
export function poisWithin(
  centerLat: number,
  centerLng: number,
  radiusM: number,
  pois: ParsedPoi[]
): PoiWithDistance[] {
  const result: PoiWithDistance[] = []
  for (const poi of pois) {
    const d = haversine(centerLat, centerLng, poi.lat, poi.lng)
    if (d <= radiusM) {
      result.push({ poi, distance: d })
    }
  }
  result.sort((a, b) => a.distance - b.distance)
  return result
}

export interface CellIntersection {
  token: string
  distance: number
}

/**
 * Find S2 cells at a given level whose polygon intersects a circle.
 * Uses pre-filter (distance to center + cell circumradius) then exact test.
 */
export function cellsIntersectingCircle(
  centerLat: number,
  centerLng: number,
  radiusM: number,
  level: 14 | 17
): CellIntersection[] {
  // Estimate cell side length for pre-filter
  const cellSide = level === 14 ? 600 : 70
  const circumradius = (cellSide * Math.SQRT2) / 2 // half diagonal

  // Get cells covering an expanded bounds
  const padDeg = ((radiusM + circumradius) / EARTH_RADIUS_M) * (180 / Math.PI)
  const bounds: Bounds = {
    south: centerLat - padDeg,
    north: centerLat + padDeg,
    west: centerLng - padDeg,
    east: centerLng + padDeg
  }

  const { tokens } = cellsCoveringBounds(bounds, level, 5000)
  const result: CellIntersection[] = []

  for (const token of tokens) {
    const verts = cellVertices(token)
    if (verts.length < 3) continue

    // Pre-filter: distance from center to cell center
    const [cLat, cLng] = cellCenter(token)
    const distToCenter = haversine(centerLat, centerLng, cLat, cLng)
    if (distToCenter > radiusM + circumradius) continue

    // Exact test: distance from center to polygon
    const dist = pointToPolygonDistance(centerLat, centerLng, verts)
    if (dist <= radiusM) {
      result.push({ token, distance: dist })
    }
  }

  return result
}
