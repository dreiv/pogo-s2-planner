import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../MapView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../PwaUpdate.vue', () => ({ default: { template: '<div />' } }))
// Keep the 1.5 MB bundled seed out of component tests.
vi.mock('../../data/initialData', () => ({ loadInitialDataset: async () => null }))

import App from '../../App.vue'
import { useDatasetStore } from '../../stores/dataset'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('App sidebar', () => {
  it('renders every section with a button header in the planned order', () => {
    const w = mount(App, { global: { plugins: [createPinia()] } })
    const ids = w.findAll('[id^="section-"]').map((e) => e.attributes('id'))
    expect(ids).toEqual([
      'section-grids',
      'section-poi',
      'section-gymspots',
      'section-marks',
      'section-range',
      'section-legend',
      'section-data',
      'section-import',
      'section-backup',
      'section-glossary',
      'section-danger'
    ])
    for (const b of w.findAll('.panel-content h3 button, .panel-content h2 button')) {
      expect(b.attributes('aria-expanded')).toBeDefined()
    }
  })

  it('starts with every section collapsed, even if an older version saved open ones', () => {
    localStorage.setItem(
      'pogo-s2-planner:ui',
      JSON.stringify({ openSections: { stats: true, grids: true, import: true } })
    )
    const w = mount(App, { global: { plugins: [createPinia()] } })
    const toggles = w.findAll('.section-toggle')
    expect(toggles.length).toBeGreaterThan(0)
    for (const b of toggles) expect(b.attributes('aria-expanded')).toBe('false')
  })

  it('has no S14 statistics or Field section', () => {
    const w = mount(App, { global: { plugins: [createPinia()] } })
    expect(w.find('#section-stats').exists()).toBe(false)
    expect(w.find('#section-field').exists()).toBe(false)
    expect(w.text()).not.toMatch(/S14 statistics/i)
  })

  it('sidebar DOM does not grow with the imported dataset', async () => {
    const pinia = createPinia()
    const w = mount(App, { global: { plugins: [pinia] } })
    await new Promise((r) => setTimeout(r, 50))
    const before = w.findAll('*').length
    const data = Array.from({ length: 300 }, (_, i) => ({
      metadata: {
        s2CellId: (0x47b2f00000000000n + BigInt(i) * 0x100000000n).toString(16),
        count: 1
      },
      pois: [
        {
          poiId: `big-${i}`,
          latE6: 45_000_000 + i,
          lngE6: 21_000_000 + i,
          title: `P${i}`,
          gmo: []
        }
      ]
    }))
    await useDatasetStore(pinia).importDocuments([{ name: 'big', json: { result: { data } } }])
    await w.vm.$nextTick()
    expect(w.findAll('*').length).toBeLessThanOrEqual(before + 40)
  })

  it('keeps the closed side panel out of the tab order and closes it with Escape', async () => {
    const w = mount(App, { attachTo: document.body, global: { plugins: [createPinia()] } })
    const panel = w.get('#side-panel')
    expect(panel.attributes('inert')).toBeDefined()
    expect(w.get('.panel-toggle').attributes('aria-controls')).toBe('side-panel')

    await w.get('.panel-toggle').trigger('click')
    expect(panel.attributes('inert')).toBeUndefined()
    expect(w.get('.panel-toggle').attributes('aria-expanded')).toBe('true')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(panel.attributes('inert')).toBeDefined()
    expect(w.get('.panel-toggle').attributes('aria-expanded')).toBe('false')
    w.unmount()
  })

  it('shows an alert when saved data cannot be read', async () => {
    const pinia = createPinia()
    const w = mount(App, { global: { plugins: [pinia] } })
    expect(w.find('.storage-banner').exists()).toBe(false)
    useDatasetStore(pinia).loadError = 'IndexedDB blocked'
    await w.vm.$nextTick()
    const banner = w.get('.storage-banner')
    expect(banner.attributes('role')).toBe('alert')
    expect(banner.text()).toContain('IndexedDB blocked')
  })
})
