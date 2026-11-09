import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextGym, type GymHintCell } from '../../core/gymHints'

const ops: string[] = []
const labels: string[] = []
const classes: string[] = []
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
    classes.push(o.html.className)
    return {}
  }
  return { default: { layerGroup, divIcon, marker: () => ({}) } }
})

import { GymHintLayer } from '../GymHintLayer'

function cell(token: string, lat: number, count = 4, partial = false): GymHintCell {
  return {
    token,
    lat,
    lng: 21,
    hint: nextGym(count)!,
    reported: count,
    imported: count,
    partial
  }
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

const OPTS = { minZoom: 13, maxRemaining: 3 }

beforeEach(() => {
  ops.length = 0
  labels.length = 0
  classes.length = 0
  removed.length = 0
})

describe('GymHintLayer', () => {
  it('draws one badge per hinted cell in view, with the label text', () => {
    const { map } = makeMap(15, 45, 46)
    const layer = new GymHintLayer(map, OPTS)
    layer.setHints([cell('a', 45.1, 4), cell('b', 45.2, 5), cell('far', 60)])
    expect(ops.filter((o) => o === 'add')).toHaveLength(2)
    expect(labels).toEqual(['+2 → 2nd gym', '+1 → 2nd gym'])
  })

  it('draws a partial cell as "?" with the outlined style', () => {
    const { map } = makeMap(15, 45, 46)
    new GymHintLayer(map, OPTS).setHints([cell('p', 45.1, 4, true)])
    expect(labels).toEqual(['+2? → 2nd gym'])
    expect(classes).toEqual(['gym-hint gym-hint--partial'])
  })

  it('draws nothing below the minimum zoom and brings the badges back when zooming in', () => {
    const { map, zoomTo } = makeMap(12, 45, 46)
    const layer = new GymHintLayer(map, OPTS)
    layer.setHints([cell('a', 45.1, 5)])
    expect(ops.filter((o) => o === 'add')).toHaveLength(0)
    zoomTo(13)
    expect(ops.filter((o) => o === 'add')).toHaveLength(1)
    zoomTo(12)
    expect(ops).toContain('clear')
  })

  it('zoomed out, keeps only the closest hints and adds the others when zooming in', () => {
    const { map, zoomTo } = makeMap(13, 45, 46)
    const layer = new GymHintLayer(map, OPTS)
    layer.setHints([cell('c1', 45.1, 5), cell('c2', 45.2, 4), cell('c3', 45.3, 3)]) // +1, +2, +3
    expect(labels).toEqual(['+1 → 2nd gym'])
    zoomTo(14)
    expect(labels).toEqual(['+1 → 2nd gym', '+2 → 2nd gym'])
    zoomTo(15)
    expect(labels).toHaveLength(3)
    zoomTo(13)
    expect(ops.filter((o) => o === 'remove')).toHaveLength(2)
  })

  it('a lower maxRemaining setting hides the farther hints right away', () => {
    const { map } = makeMap(16, 45, 46)
    const layer = new GymHintLayer(map, OPTS)
    layer.setHints([cell('a', 45.1, 5), cell('b', 45.2, 3)])
    ops.length = 0
    layer.setOptions({ maxRemaining: 1 })
    expect(ops).toEqual(['remove'])
  })

  it('destroy removes its listeners', () => {
    const { map } = makeMap(14, 45, 46)
    new GymHintLayer(map, OPTS).destroy()
    expect(removed).toEqual(expect.arrayContaining(['zoomend', 'moveend']))
  })
})
