import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MapView from '../components/MapView.vue'

// Mock leaflet
vi.mock('leaflet', () => {
  const mockMap = {
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 44.4, lng: 26.1 })),
    getZoom: vi.fn(() => 13),
    setView: vi.fn(),
    removeLayer: vi.fn(),
    getBounds: vi.fn(() => ({
      getSouth: vi.fn(() => 44.0),
      getNorth: vi.fn(() => 44.5),
      getWest: vi.fn(() => 26.0),
      getEast: vi.fn(() => 26.5)
    }))
  }
  const mockTileLayer = { addTo: vi.fn() }
  const mockLayerGroup = {
    addTo: vi.fn(),
    remove: vi.fn(),
    clearLayers: vi.fn(),
    addLayer: vi.fn()
  }
  const mockCircleMarker = {
    bindPopup: vi.fn(),
    setStyle: vi.fn(),
    addTo: vi.fn()
  }
  return {
    default: {
      map: vi.fn(() => mockMap),
      tileLayer: vi.fn(() => mockTileLayer),
      layerGroup: vi.fn(() => mockLayerGroup),
      circleMarker: vi.fn(() => mockCircleMarker),
      polygon: vi.fn(() => ({ addTo: vi.fn(), on: vi.fn() })),
      popup: vi.fn(() => ({
        setLatLng: vi.fn(),
        setContent: vi.fn(),
        openOn: vi.fn()
      }))
    }
  }
})

vi.mock('../map/createMap', () => ({
  createMap: vi.fn(() => ({
    on: vi.fn(),
    remove: vi.fn(),
    getCenter: vi.fn(() => ({ lat: 44.4, lng: 26.1 })),
    getZoom: vi.fn(() => 13)
  }))
}))

vi.mock('../map/locateMe', () => ({
  locateMe: vi.fn(() => vi.fn())
}))

describe('MapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('mounts without error', () => {
    const wrapper = mount(MapView)
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.find('.locate-btn').exists()).toBe(true)
  })

  it('cleans up on unmount', () => {
    const wrapper = mount(MapView)
    wrapper.unmount()
    // No error thrown = pass
  })
})
