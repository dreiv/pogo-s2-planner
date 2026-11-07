import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import InfoTip from '../InfoTip.vue'
import CollapsibleSection from '../CollapsibleSection.vue'
import MarksPanel from '../MarksPanel.vue'
import ImportPanel from '../ImportPanel.vue'
import DangerZone from '../DangerZone.vue'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('InfoTip', () => {
  it('toggles aria-expanded on click and closes on Escape', async () => {
    const w = mount(InfoTip, { props: { term: 'importMerge' }, attachTo: document.body })
    const btn = w.get('button')
    expect(btn.attributes('aria-expanded')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    await btn.trigger('keydown', { key: 'Escape' })
    expect(btn.attributes('aria-expanded')).toBe('false')
    w.unmount()
  })
})

describe('CollapsibleSection', () => {
  it('starts per defaultOpen and persists the toggled state', async () => {
    const w = mount(CollapsibleSection, {
      props: { id: 't1', title: 'Test' },
      slots: { default: '<p class="body">x</p>' }
    })
    const btn = w.get('button')
    expect(btn.attributes('aria-expanded')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-expanded')).toBe('true')
    expect(localStorage.getItem('pogo-s2-planner:ui')).toContain('"t1":true')
  })
})

describe('MarksPanel', () => {
  it('shows an empty state, then a five-status radio group for a selected cell', async () => {
    const w = mount(MarksPanel)
    expect(w.findAll('input[type="radio"]')).toHaveLength(0)
    ;(w.vm as unknown as { selectCell(t: string): void }).selectCell('47b2f3c5')
    await w.vm.$nextTick()
    expect(w.findAll('input[type="radio"]')).toHaveLength(5)
    const del = w.findAll('button').find((b) => /delete mark/i.test(b.text()))
    expect(del?.attributes('disabled')).toBeDefined()
  })
})

describe('ImportPanel', () => {
  it('disables the paste import button until there is text', async () => {
    const w = mount(ImportPanel)
    const btn = w.findAll('button').find((b) => /import from text/i.test(b.text()))
    expect(btn?.attributes('disabled')).toBeDefined()
    await w.get('textarea').setValue('{}')
    expect(btn?.attributes('disabled')).toBeUndefined()
  })
})

describe('DangerZone', () => {
  it('does not render delete controls until the section is opened', async () => {
    const w = mount(DangerZone)
    expect(w.get('button').attributes('aria-expanded')).toBe('false')
  })
})
