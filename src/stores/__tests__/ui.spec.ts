import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useUiStore } from '../ui'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('ui store', () => {
  it('drops open-state saved by an older version but keeps introDismissed', () => {
    localStorage.setItem(
      'pogo-s2-planner:ui',
      JSON.stringify({ openSections: { stats: true, grids: true }, introDismissed: true })
    )
    const ui = useUiStore()
    expect(ui.openSections).toEqual({})
    expect(ui.introDismissed).toBe(true)
  })

  it('keeps open-state saved by the current version', () => {
    const first = useUiStore()
    first.setOpen('poi', true)
    setActivePinia(createPinia())
    const second = useUiStore()
    expect(second.openSections).toEqual({ poi: true })
  })
})
