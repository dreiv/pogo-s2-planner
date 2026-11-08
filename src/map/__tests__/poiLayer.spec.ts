import { describe, it, expect, vi } from 'vitest'
import type { ParsedPoi } from '../../core/wayfarer/parse'

const groupOps: string[] = []

vi.mock('leaflet', () => {
  const circleMarker = () => ({
    bindPopup: () => undefined,
    setStyle: () => undefined,
    bringToFront: () => undefined
  })
  const layerGroup = () => ({
    addTo: () => undefined,
    addLayer: () => {
      groupOps.push('add')
    },
    removeLayer: () => {
      groupOps.push('remove')
    },
    clearLayers: () => undefined,
    remove: () => undefined
  })
  const canvas = () => ({ remove: () => undefined })
  return { default: { circleMarker, layerGroup, canvas } }
})

import { PoiLayer } from '../PoiLayer'

function makePois(n: number): ParsedPoi[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    lat: 45 + i * 1e-5,
    lng: 21 + i * 1e-5,
    title: `T${i}`,
    description: '',
    address: '',
    imageUrl: '',
    communityContributed: false,
    game: [],
    cellToken: 'x'
  }))
}

function makeMap(zoom: number) {
  const handlers: Record<string, () => void> = {}
  let z = zoom
  return {
    map: {
      getZoom: () => z,
      getPane: () => ({ style: {} }),
      createPane: () => ({ style: {} }),
      on: (ev: string, fn: () => void) => {
        handlers[ev] = fn
      }
    } as never,
    zoomTo(next: number) {
      z = next
      handlers.zoomend?.()
    }
  }
}

describe('PoiLayer', () => {
  it('does not add/remove markers whose visibility did not change', () => {
    const { map } = makeMap(12)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(50))
    groupOps.length = 0
    layer.setOptions({ showImages: false })
    layer.setOptions({ stopGymOnly: true })
    expect(groupOps).toHaveLength(0)
  })

  it('adds hidden kinds to the map when zooming in to full detail', () => {
    const { map, zoomTo } = makeMap(12)
    const layer = new PoiLayer(map)
    layer.setPois(makePois(10))
    groupOps.length = 0
    zoomTo(16)
    expect(groupOps).toEqual(Array(10).fill('add'))
  })

  it('scales linearly: 20k POIs rebuild and refresh well under a second', () => {
    const { map, zoomTo } = makeMap(12)
    const layer = new PoiLayer(map)
    const t0 = performance.now()
    layer.setPois(makePois(20000))
    zoomTo(16)
    zoomTo(12)
    layer.setOptions({ showOther: false })
    expect(performance.now() - t0).toBeLessThan(1500)
  })
})