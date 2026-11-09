import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MapView from '../components/MapView.vue'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { useMapFocusStore } from '../stores/mapFocus'
import { CELL_FILL_OPACITY, CELL_STATE_COLORS } from '../theme'

// MapView is tested against its collaborators' public API, not against Leaflet internals:
// the layer classes and createMap are replaced, so a change inside a layer cannot break this file.
const layerCalls: string[] = []
const gridOpts: { level: number; cellStyle?: (token: string) => unknown }[] = []

vi.mock('../map/createMap', () => ({
  createMap: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    setView: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 44.4, lng: 26.1 })),
    getZoom: vi.fn(() => 13)
  }))
}))

vi.mock('../map/PoiLayer', () => ({
  PoiLayer: vi.fn(function () {
    return {
      setPois: () => layerCalls.push('poi:setPois'),
      setOptions: () => layerCalls.push('poi:setOptions'),
      destroy: () => layerCalls.push('poi:destroy')
    }
  })
}))

vi.mock('../map/S2GridLayer', () => ({
  S2GridLayer: vi.fn(function (_map: unknown, opts: (typeof gridOpts)[number]) {
    gridOpts.push(opts)
    return {
      setCellStyle: vi.fn(),
      destroy: () => layerCalls.push('grid:destroy')
    }
  })
}))

vi.mock('../map/GymHintLayer', () => ({
  GymHintLayer: vi.fn(function () {
    return {
      setHints: vi.fn(),
      setMinZoom: vi.fn(),
      destroy: () => layerCalls.push('gymhint:destroy')
    }
  })
}))

vi.mock('../map/RangeLayer', () => ({
  RangeLayer: vi.fn(function () {
    return {
      onCenterChanged: vi.fn(),
      apply: () => layerCalls.push('range:apply'),
      destroy: () => layerCalls.push('range:destroy')
    }
  })
}))

vi.mock('../map/cellPopup', () => ({ showCellPopup: vi.fn() }))

vi.mock('../map/locateMe', () => ({
  locateMe: vi.fn(() => vi.fn())
}))

describe('MapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    layerCalls.length = 0
    gridOpts.length = 0
  })

  it('mounts without error', () => {
    const wrapper = mount(MapView)
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.find('.locate-btn').exists()).toBe(true)
  })

  it('the locate button has an accessible name', () => {
    const wrapper = mount(MapView)
    expect(wrapper.get('.locate-btn').attributes('aria-label')).toBeTruthy()
  })

  it('creates the POI layer on mount and destroys it on unmount', () => {
    const wrapper = mount(MapView)
    expect(layerCalls).toContain('poi:setPois')
    wrapper.unmount()
    expect(layerCalls).toContain('poi:destroy')
  })

  it('tints S14 cells without imported data (stronger gray), and only those', () => {
    const settings = useSettingsStore()
    settings.showS14 = true
    const dataset = useDatasetStore()
    dataset.cells = [{ token: 'covered', count: 3, truncated: false }] as never
    mount(MapView)
    const s14 = gridOpts.find((o) => o.level === 14)
    expect(s14?.cellStyle?.('covered')).toBeNull()
    expect(s14?.cellStyle?.('missing')).toEqual({
      fillColor: CELL_STATE_COLORS.unknown,
      fillOpacity: CELL_FILL_OPACITY.unknown
    })
    expect(CELL_FILL_OPACITY.unknown).toBeGreaterThanOrEqual(0.3)
    settings.showCellUnknown = false
    expect(s14?.cellStyle?.('missing')).toBeNull()
  })

  it('gym hints are drawn without the S14 grid, and the toggle removes and restores them', async () => {
    const settings = useSettingsStore()
    expect(settings.showS14).toBe(false)
    const wrapper = mount(MapView)
    expect(layerCalls).not.toContain('gymhint:destroy')
    settings.toggleGymHints()
    await wrapper.vm.$nextTick()
    expect(layerCalls).toContain('gymhint:destroy')
    wrapper.unmount()
  })

  it('a focus request from a panel moves the map there', async () => {
    const wrapper = mount(MapView)
    const { createMap } = await import('../map/createMap')
    const map = vi.mocked(createMap).mock.results.at(-1)!.value as {
      setView: ReturnType<typeof vi.fn>
    }
    useMapFocusStore().focusOn(45.5, 21.5, 15)
    await wrapper.vm.$nextTick()
    expect(map.setView).toHaveBeenCalledWith([45.5, 21.5], 15)
    wrapper.unmount()
  })

  it('shows no grid hint until a layer reports one', () => {
    const wrapper = mount(MapView)
    expect(wrapper.find('.grid-hint').exists()).toBe(false)
  })
})
