import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../MapView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../PwaUpdate.vue', () => ({ default: { template: '<div />' } }))

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
      'section-marks',
      'section-range',
      'section-legend',
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
      metadata: { s2CellId: (0x47b2f00000000000n + BigInt(i) * 0x100000000n).toString(16), count: 1 },
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
})
