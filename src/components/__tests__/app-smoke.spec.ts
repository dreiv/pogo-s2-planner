import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../MapView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('../PwaUpdate.vue', () => ({ default: { template: '<div />' } }))

import App from '../../App.vue'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('App sidebar', () => {
  it('renders every section with a button header in the planned order', () => {
    const w = mount(App, { global: { plugins: [createPinia()] } })
    const ids = w.findAll('[id^="section-"]').map((e) => e.attributes('id'))
    expect(ids).toEqual([
      'section-stats',
      'section-marks',
      'section-range',
      'section-grids',
      'section-poi',
      'section-field',
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
})
