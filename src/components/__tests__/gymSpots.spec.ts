import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import GymSpotsPanel from '../GymSpotsPanel.vue'
import GridsPanel from '../GridsPanel.vue'
import SelectRow from '../SelectRow.vue'
import { useDatasetStore } from '../../stores/dataset'
import { useMapFocusStore } from '../../stores/mapFocus'
import { useSettingsStore } from '../../stores/settings'
import { nextGym, type GymHintCell } from '../../core/gymHints'

function cell(token: string, count: number, partial = false): GymHintCell {
  return {
    token,
    lat: 45 + count / 100,
    lng: 21,
    hint: nextGym(count)!,
    reported: count,
    imported: count,
    partial
  }
}

function mountPanel(cells: GymHintCell[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const dataset = useDatasetStore()
  Object.defineProperty(dataset, 'gymHints', { value: cells, configurable: true })
  localStorage.clear()
  return {
    wrapper: mount(GymSpotsPanel, { global: { plugins: [pinia] } }),
    focus: useMapFocusStore(),
    settings: useSettingsStore()
  }
}

beforeEach(() => {
  localStorage.clear()
})

describe('GymSpotsPanel', () => {
  it('lists the cells close to a gym, closest first, and skips the far ones', async () => {
    const { wrapper } = mountPanel([cell('far', 10), cell('b', 4), cell('a', 5), cell('c', 3)])
    await wrapper.find('.section-toggle').trigger('click')
    const rows = wrapper.findAll('.spot')
    expect(rows.map((r) => r.find('.spot-badge').text())).toEqual([
      '+1 → 2nd gym',
      '+2 → 2nd gym',
      '+3 → 2nd gym'
    ])
    expect(rows[0]!.text()).toContain('5 stops and gyms')
    expect(wrapper.text()).toContain('3 cells close to a gym')
  })

  it('says why the list is empty, with the current thresholds', async () => {
    const { wrapper, settings } = mountPanel([cell('far', 10)])
    settings.setGymHintMinCount(4)
    await wrapper.find('.section-toggle').trigger('click')
    expect(wrapper.find('.spot').exists()).toBe(false)
    expect(wrapper.text()).toContain('from 4 stops and gyms')
  })

  it('marks cells with incomplete data', async () => {
    const { wrapper } = mountPanel([cell('p', 4, true)])
    await wrapper.find('.section-toggle').trigger('click')
    expect(wrapper.find('.spot-badge.partial').text()).toBe('+2? → 2nd gym')
    expect(wrapper.find('.spot').text()).toContain('data may be incomplete')
  })

  it('clicking a row sends the map there and asks the sidebar to close', async () => {
    const { wrapper, focus } = mountPanel([cell('a', 5)])
    await wrapper.find('.section-toggle').trigger('click')
    await wrapper.find('.spot').trigger('click')
    expect(focus.request).toMatchObject({ lat: 45.05, lng: 21, zoom: 15 })
    expect(wrapper.emitted('navigate')).toHaveLength(1)
  })

  it('a wider "at most N more" setting adds the farther cells', async () => {
    const { wrapper, settings } = mountPanel([cell('x', 3), cell('y', 17)])
    await wrapper.find('.section-toggle').trigger('click')
    settings.setGymHintMaxRemaining(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.spot').exists()).toBe(false)
    settings.setGymHintMaxRemaining(3)
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.spot')).toHaveLength(2)
  })
})

describe('mapFocus store', () => {
  it('asking for the same place twice still produces a new request', () => {
    setActivePinia(createPinia())
    const focus = useMapFocusStore()
    focus.focusOn(1, 2, 15)
    const first = focus.request
    focus.focusOn(1, 2, 15)
    expect(focus.request).not.toBe(first)
    expect(focus.request?.seq).toBe(2)
  })
})

describe('SelectRow', () => {
  it('offers every whole number in range and emits the chosen one', async () => {
    const w = mount(SelectRow, { props: { modelValue: 3, label: 'L', min: 1, max: 5, unit: 'x' } })
    const opts = w.findAll('option')
    expect(opts.map((o) => o.text())).toEqual(['1 x', '2 x', '3 x', '4 x', '5 x'])
    await w.find('select').setValue('4')
    expect(w.emitted('update:modelValue')).toEqual([[4]])
  })
})

describe('GridsPanel gym hint settings', () => {
  it('the two selects write the settings and are only shown while the toggle is on', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    localStorage.clear()
    const settings = useSettingsStore()
    const wrapper = mount(GridsPanel, { global: { plugins: [pinia] } })
    await wrapper.find('.section-toggle').trigger('click')
    const selects = wrapper.findAll('select')
    expect(selects).toHaveLength(2)
    await selects[0]!.setValue('5')
    await selects[1]!.setValue('2')
    expect([settings.gymHintMinCount, settings.gymHintMaxRemaining]).toEqual([5, 2])
    settings.toggleGymHints()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('select')).toHaveLength(0)
    settings.toggleGymHints()
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('select')).toHaveLength(2)
  })
})
