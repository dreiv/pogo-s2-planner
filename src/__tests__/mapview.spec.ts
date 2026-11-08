import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MapView from '../components/MapView.vue'

// MapView is tested against its collaborators' public API, not against Leaflet internals:
// the layer classes and createMap are replaced, so a change inside a layer cannot break this file.
const layerCalls: string[] = []

vi.mock('../map/createMap', () => ({
  createMap: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 44.4, lng: 26.1 })),
    getZoom: vi.fn(() => 13)
  }))
}))

vi.mock('../map/PoiLayer', () => ({
  PoiLayer: vi.fn(() => ({
    setPois: () => layerCalls.push('poi:setPois'),
    setOptions: () => layerCalls.push('poi:setOptions'),
    destroy: () => layerCalls.push('poi:destroy')
  }))
}))

vi.mock('../map/S2GridLayer', () => ({
  S2GridLayer: vi.fn(() => ({
    setCellStyle: vi.fn(),
    destroy: () => layerCalls.push('grid:destroy')
  }))
}))

vi.mock('../map/RangeLayer', () => ({
  RangeLayer: vi.fn(() => ({
    onCenterChanged: vi.fn(),
    apply: () => layerCalls.push('range:apply'),
    destroy: () => layerCalls.push('range:destroy')
  }))
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

  it('shows no grid hint until a layer reports one', () => {
    const wrapper = mount(MapView)
    expect(wrapper.find('.grid-hint').exists()).toBe(false)
  })
})
