import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedPoi } from '../../core/wayfarer/parse'

const ops: string[] = []
const markers: object[] = []
const radii: number[] = []
let groupClick: ((e: unknown) => void) | null = null
const openedAt: unknown[] = []
const removedListeners: string[] = []

vi.mock('leaflet', () => {
  const circleMarker = () => {
    const marker = {
      setRadius: (r: number) => {
        radii.push(r)
      },
      setStyle: () => undefined
    }
    markers.push(marker)
    return marker
  }
  const featureGroup = () => ({
    addTo: () => undefined,
    addLayer: () => {
      ops.push('add')
    },
    removeLayer: () => {
      ops.push('remove')
    },
    clearLayers: () => undefined,
    remove: () => undefined,
    on: (_type: string, fn: (e: unknown) => void) => {
      groupClick = fn
    },
    off: (type: string) => {
      removedListeners.push(`group:${type}`)
    }
  })
  const canvas = () => ({ remove: () => undefined })
  const popup = () => {
    const p = {
      setLatLng: (ll: unknown) => {
        openedAt.push(ll)
        return p
      },
      setContent: () => p,
      openOn: () => p,
      update: () => undefined
    }
    return p
  }
  return { default: { circleMarker, featureGroup, canvas, popup } }
})

import { PoiLayer } from '../PoiLayer'

/** Stops (game entity) laid out on a line: poi i is at lat 45 + i * 0.001. */
function makePois(n: number, game = true): ParsedPoi[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    lat: 45 + i * 0.001,
    lng: 21,
    title: `T${i}`,
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: game ? [{ entity: 'POKESTOP', status: 'ACTIVE', brand: 'HOLOHOLO' }] : [],
    cellToken: 'x'
  }))
}

interface FakeBoundsSpec {
  south: number
  north: number
}

function makeMap(zoom: number, view: FakeBoundsSpec) {
  const handlers: Record<string, () => void> = {}
  let z = zoom
  let v = view
  const bounds = () => {
    // pad() widens by `ratio` of the span on each side, like Leaflet.
    const make = (s: number, n: number) => ({
      getSouth: () => s,
      getNorth: () => n,
      getWest: () => 20,
      getEast: () => 22,
      pad: (r: number) => make(s - (n - s) * r, n + (n - s) * r)
    })
    return make(v.south, v.north)
  }
  return {
    map: {
      getZoom: () => z,
      getBounds: bounds,
      getPane: () => ({ style: {} }),
      createPane: () => ({ style: {} }),
      on: (ev: string, fn: () => void) => {
        handlers[ev] = fn
      },
      off: (ev: string) => {
        removedListeners.push(`map:${ev}`)
      }
    } as never,
    zoomTo(next: number) {
      z = next
      handlers.zoomend?.()
    },
    panTo(next: FakeBoundsSpec) {
      v = next
      handlers.moveend?.()
    }
  }
}

beforeEach(() => {
  ops.length = 0
  markers.length = 0
  radii.length = 0
  openedAt.length = 0
  removedListeners.length = 0
  groupClick = null
})

describe('PoiLayer', () => {
  // View lat 45.0004..45.0104; padded by 0.5 => 44.9954..45.0154, so POIs 0..15 qualify
  // (POI i sits at lat 45 + i * 0.001), with every edge well away from a POI.
  const VIEW = { south: 45.0004, north: 45.0104 }

  it('creates markers only for POIs inside the (padded) viewport', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(1000))
    expect(markers).toHaveLength(16)
    expect(ops.filter((o) => o === 'add')).toHaveLength(16)
  })

  it('a small pan adds only the POIs that entered the viewport', () => {
    const { map, panTo } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(1000))
    ops.length = 0
    panTo({ south: 45.0014, north: 45.0114 }) // padded top edge moves to 45.0164: POI 16 enters
    expect(ops).toEqual(['add'])
  })

  it('a large pan swaps the whole visible set and nothing else', () => {
    const { map, panTo } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(1000))
    ops.length = 0
    panTo({ south: 45.0204, north: 45.0304 }) // padded 45.0154..45.0354: POIs 16..35
    expect(ops.filter((o) => o === 'remove')).toHaveLength(16)
    expect(ops.filter((o) => o === 'add')).toHaveLength(20)
  })

  it('does not add/remove markers whose visibility did not change', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(50))
    ops.length = 0
    layer.setOptions({ showOther: false })
    layer.setOptions({ showGyms: true })
    expect(ops).toHaveLength(0)
  })

  it('adds hidden kinds when zooming in to full detail (non-game POIs hidden below zoom 16)', () => {
    const { map, zoomTo } = makeMap(12, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(10, false)) // "other" kind
    expect(ops).toHaveLength(0)
    zoomTo(16)
    expect(ops).toEqual(Array(10).fill('add'))
  })

  it('a delegated click on a marker opens one popup at that POI', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(3))
    expect(groupClick).not.toBeNull()
    groupClick?.({ layer: markers[1] })
    expect(openedAt).toEqual([[45.001, 21]])
  })

  it('a click from a layer that is not a POI marker is ignored', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(3))
    groupClick?.({ layer: {} })
    expect(openedAt).toHaveLength(0)
  })

  describe('thinning', () => {
    // Stops 0.001 deg (~16 px at zoom 14) apart: neighbours share a 26 px square at zoom 12-13.
    it('draws fewer markers when zoomed out than at full detail, and all at full detail', () => {
      const { map, zoomTo } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: true })
      layer.setPois(makePois(16))
      const thinnedCount = markers.length
      expect(thinnedCount > 0 && thinnedCount < 16).toBe(true)
      zoomTo(16)
      // POI 0..15 are all in the padded view at zoom 16 too (same fake bounds).
      expect(ops.filter((o) => o === 'add')).toHaveLength(16)
    })

    it('draws every POI below full detail zoom when thinning is off', () => {
      const { map } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: false })
      layer.setPois(makePois(16))
      expect(markers).toHaveLength(16)
    })

    it('toggling thinning off adds back the hidden POIs', () => {
      const { map } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: true })
      layer.setPois(makePois(16))
      layer.setOptions({ thinOut: false })
      expect(ops.filter((o) => o === 'add')).toHaveLength(16)
    })

    it('a pan at the same zoom does not swap the dots that stay in view', () => {
      const { map, panTo } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: true })
      layer.setPois(makePois(60))
      const before = markers.length
      ops.length = 0
      panTo({ south: 45.0014, north: 45.0114 })
      expect(ops.filter((o) => o === 'remove')).toHaveLength(0)
      expect(markers.length >= before).toBe(true)
    })

    it('reports whether anything is hidden through onThinChange', () => {
      const states: boolean[] = []
      const { map, zoomTo } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: true, onThinChange: (t) => states.push(t) })
      layer.setPois(makePois(16))
      expect(states).toEqual([true])
      zoomTo(16)
      expect(states).toEqual([true, false])
    })

    it('does not report thinning when the points are far apart', () => {
      const states: boolean[] = []
      const { map } = makeMap(12, VIEW)
      const layer = new PoiLayer(map, { thinOut: true, onThinChange: (t) => states.push(t) })
      layer.setPois(makePois(1))
      expect(states).toEqual([])
    })

    it('shrinks live markers when the zoom changes dot size', () => {
      const { map, zoomTo } = makeMap(16, VIEW)
      const layer = new PoiLayer(map, { thinOut: true })
      layer.setPois(makePois(3))
      expect(radii).toHaveLength(0)
      zoomTo(12)
      expect(radii.length > 0).toBe(true)
      expect(radii.every((r) => r >= 3 && r < 6)).toBe(true)
    })
  })

  it('showGyms / showStops hide and restore their own kind', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    const pois = makePois(4)
    pois[1]!.game = [{ entity: 'GYM', status: 'ACTIVE', brand: 'HOLOHOLO' }]
    layer.setPois(pois)
    expect(ops.filter((o) => o === 'add')).toHaveLength(4)
    ops.length = 0
    layer.setOptions({ showGyms: false })
    expect(ops).toEqual(['remove'])
    ops.length = 0
    layer.setOptions({ showStops: false })
    expect(ops).toEqual(['remove', 'remove', 'remove'])
    ops.length = 0
    layer.setOptions({ showGyms: true, showStops: true })
    expect(ops).toEqual(Array(4).fill('add'))
  })

  it('destroy removes every listener it added', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.destroy()
    expect(removedListeners).toContain('map:zoomend')
    expect(removedListeners).toContain('map:moveend')
    expect(removedListeners).toContain('group:click')
  })
})
