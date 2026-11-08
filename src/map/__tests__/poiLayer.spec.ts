import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedPoi } from '../../core/wayfarer/parse'

const ops: string[] = []
const markers: object[] = []
let groupClick: ((e: unknown) => void) | null = null
const openedAt: unknown[] = []
const removedListeners: string[] = []

vi.mock('leaflet', () => {
  const circleMarker = () => {
    const marker = {}
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
    layer.setOptions({ showImages: false })
    layer.setOptions({ stopGymOnly: true })
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

  it('destroy removes every listener it added', () => {
    const { map } = makeMap(14, VIEW)
    const layer = new PoiLayer(map)
    layer.destroy()
    expect(removedListeners).toContain('map:zoomend')
    expect(removedListeners).toContain('map:moveend')
    expect(removedListeners).toContain('group:click')
  })
})
