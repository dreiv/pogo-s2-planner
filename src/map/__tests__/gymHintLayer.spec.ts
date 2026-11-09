import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GymHintCell } from '../../core/gymHints'

const ops: string[] = []
const labels: string[] = []
const removed: string[] = []

vi.mock('leaflet', () => {
  const layerGroup = () => {
    const g = {
      addTo: () => g,
      addLayer: () => {
        ops.push('add')
      },
      removeLayer: () => {
        ops.push('remove')
      },
      clearLayers: () => {
        ops.push('clear')
      },
      remove: () => undefined
    }
    return g
  }
  const divIcon = (o: { html: HTMLElement }) => {
    labels.push(o.html.textContent ?? '')
    return {}
  }
  return { default: { layerGroup, divIcon, marker: () => ({}) } }
})

import { GymHintLayer } from '../GymHintLayer'

function cell(token: string, lat: number, remaining = 2): GymHintCell {
  return { token, lat, lng: 21, hint: { count: 6 - remaining, remaining, gymsNow: 1, gymsNext: 2 } }
}

function makeMap(zoom: number, south: number, north: number) {
  const handlers: Record<string, () => void> = {}
  let z = zoom
  return {
    map: {
      getZoom: () => z,
      getBounds: () => ({
        pad: () => ({ contains: ([lat]: [number, number]) => lat >= south && lat <= north })
      }),
      on: (ev: string, fn: () => void) => {
        handlers[ev] = fn
      },
      off: (ev: string) => {
        removed.push(ev)
      }
    } as never,
    zoomTo(next: number) {
      z = next
      handlers.zoomend?.()
    }
  }
}

beforeEach(() => {
  ops.length = 0
  labels.length = 0
  removed.length = 0
})

describe('GymHintLayer', () => {
  it('draws one badge per hinted cell in view, with the label text', () => {
    const { map } = makeMap(14, 45, 46)
    const layer = new GymHintLayer(map, { minZoom: 13 })
    layer.setHints([cell('a', 45.1), cell('b', 45.2, 1), cell('far', 60)])
    expect(ops.filter((o) => o === 'add')).toHaveLength(2)
    expect(labels).toEqual(['+2 → 2nd gym', '+1 → 2nd gym'])
  })

  it('draws nothing below the minimum zoom and brings the badges back when zooming in', () => {
    const { map, zoomTo } = makeMap(12, 45, 46)
    const layer = new GymHintLayer(map, { minZoom: 13 })
    layer.setHints([cell('a', 45.1)])
    expect(ops.filter((o) => o === 'add')).toHaveLength(0)
    zoomTo(13)
    expect(ops.filter((o) => o === 'add')).toHaveLength(1)
    zoomTo(12)
    expect(ops).toContain('clear')
  })

  it('destroy removes its listeners', () => {
    const { map } = makeMap(14, 45, 46)
    new GymHintLayer(map, { minZoom: 13 }).destroy()
    expect(removed).toEqual(expect.arrayContaining(['zoomend', 'moveend']))
  })
})
