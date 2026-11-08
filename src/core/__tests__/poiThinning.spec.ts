import { describe, it, expect } from 'vitest'
import {
  MIN_MARKER_RADIUS,
  poiMarkerScale,
  scaledMarkerRadius,
  thinCellPx,
  thinPois,
  toWorld,
  type ThinCandidate
} from '../poiThinning'
import type { PoiKind } from '../classify'

/** A candidate `px` pixels (at `zoom`) east of the world origin. */
function at(id: string, kind: PoiKind, px: number, zoom: number, py = 100): ThinCandidate {
  const world = 256 * 2 ** zoom
  return { id, kind, nx: px / world, ny: py / world }
}

describe('toWorld', () => {
  it('maps the equator/prime meridian to the middle of the world', () => {
    const w = toWorld(0, 0)
    expect(w.nx).toBe(0.5)
    expect(Math.abs(w.ny - 0.5) < 1e-12).toBe(true)
  })
  it('puts the west edge at 0 and north above south', () => {
    expect(toWorld(0, -180).nx).toBe(0)
    expect(toWorld(60, 0).ny < toWorld(-60, 0).ny).toBe(true)
  })
  it('does not blow up at the poles', () => {
    expect(Number.isFinite(toWorld(90, 0).ny)).toBe(true)
  })
})

describe('thinCellPx', () => {
  it('is 0 (no thinning) at and above full detail zoom', () => {
    expect(thinCellPx(16, 16)).toBe(0)
    expect(thinCellPx(18, 16)).toBe(0)
  })
  it('grows as the map zooms out', () => {
    const sizes = [15, 14, 13, 12].map((z) => thinCellPx(z, 16))
    expect(sizes[0]! > 0).toBe(true)
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]! >= sizes[i - 1]!).toBe(true)
  })
})

describe('poiMarkerScale / scaledMarkerRadius', () => {
  it('is 1 at full detail and shrinks when zoomed out', () => {
    expect(poiMarkerScale(16, 16)).toBe(1)
    expect(poiMarkerScale(15, 16) < 1).toBe(true)
    expect(poiMarkerScale(12, 16) < poiMarkerScale(15, 16)).toBe(true)
  })
  it('never goes below the minimum radius', () => {
    expect(scaledMarkerRadius(4, 0.1)).toBe(MIN_MARKER_RADIUS)
    expect(scaledMarkerRadius(7, 1)).toBe(7)
  })
})

describe('thinPois', () => {
  const Z = 13

  it('returns everything when the cell size is 0', () => {
    const c = [at('a', 'stop', 10, Z), at('b', 'stop', 11, Z)]
    expect(thinPois(c, Z, 0).size).toBe(2)
  })

  it('keeps one of two POIs that share a screen square', () => {
    const c = [at('a', 'stop', 1, Z), at('b', 'stop', 5, Z)] // same 26px square
    expect(thinPois(c, Z, 26).size).toBe(1)
  })

  it('keeps POIs that are in different squares', () => {
    const c = [at('a', 'stop', 1, Z), at('b', 'stop', 60, Z)]
    expect(thinPois(c, Z, 26).size).toBe(2)
  })

  it('a gym wins over a stop in the same square', () => {
    const stop = at('a', 'stop', 1, Z)
    const gym = at('z', 'gym', 5, Z)
    const kept = thinPois([stop, gym], Z, 26)
    expect(kept.has(gym)).toBe(true)
    expect(kept.has(stop)).toBe(false)
  })

  it('ties on kind are broken by id, whatever the input order', () => {
    const a = at('a', 'stop', 1, Z)
    const b = at('b', 'stop', 5, Z)
    expect(thinPois([a, b], Z, 26).has(a)).toBe(true)
    expect(thinPois([b, a], Z, 26).has(a)).toBe(true)
  })

  it('never keeps more than it was given and keeps at least one when non-empty', () => {
    const c = Array.from({ length: 200 }, (_, i) => at(`p${i}`, 'stop', i * 3, Z, (i % 7) * 4))
    const kept = thinPois(c, Z, 26)
    expect(kept.size > 0).toBe(true)
    expect(kept.size < c.length).toBe(true)
  })

  it('is empty for no candidates', () => {
    expect(thinPois([], Z, 26).size).toBe(0)
  })
})
