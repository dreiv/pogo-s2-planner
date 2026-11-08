import { describe, it, expect } from 'vitest'
import { buildCellPopupContent } from '../cellPopupContent'

describe('buildCellPopupContent', () => {
  const base = { s17Token: '47455d0c', s14Token: '47455d1', state: 'occupied' }

  it('shows tokens, state and POI count as text', () => {
    const el = buildCellPopupContent({ ...base, pois: [{ id: 'a', title: 'Stop A' }] })
    expect(el.textContent).toContain('S17: 47455d0c')
    expect(el.textContent).toContain('S14: 47455d1')
    expect(el.textContent).toContain('State: occupied')
    expect(el.textContent).toContain('POIs: 1')
    expect(el.querySelectorAll('li')).toHaveLength(1)
  })

  it('never interprets a POI title as HTML (community-contributed text)', () => {
    const evil = '<img src=x onerror="alert(1)"><script>alert(2)</script>'
    const el = buildCellPopupContent({ ...base, pois: [{ id: 'a', title: evil }] })
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('script')).toBeNull()
    expect(el.querySelector('li')?.textContent).toBe(evil)
  })

  it('falls back to the id for untitled POIs and omits the list when empty', () => {
    const untitled = buildCellPopupContent({ ...base, pois: [{ id: 'poi-9', title: '' }] })
    expect(untitled.querySelector('li')?.textContent).toBe('poi-9')
    const none = buildCellPopupContent({ ...base, pois: [] })
    expect(none.querySelector('ul')).toBeNull()
    expect(none.textContent).toContain('POIs: 0')
  })

  it('leads with a plain-language title and reason, tokens stay available under Details', () => {
    const el = buildCellPopupContent({
      ...base,
      state: 'free-uncertain',
      s14PoiCount: 53,
      pois: []
    })
    expect(el.querySelector('.cell-popup-title')?.textContent).toBe('Free, data may be incomplete')
    expect(el.querySelector('.cell-popup-why')?.textContent).toContain('53 POIs')
    const details = el.querySelector('details')
    expect(details?.textContent).toContain('S17: 47455d0c')
    expect(details?.textContent).toContain('State: free-uncertain')
  })

  it('on a no-data cell, says where to look and links to Wayfarer', () => {
    const el = buildCellPopupContent({
      ...base,
      state: 'unknown',
      lat: 45.763568,
      lng: 21.222723,
      pois: []
    })
    expect(el.querySelector('.cell-popup-title')?.textContent).toBe('No data')
    const action = el.querySelector('.cell-popup-action')
    expect(action?.textContent).toContain('Import panel')
    const coords = action?.querySelector('code.cell-popup-coords') as HTMLElement | null
    expect(coords?.textContent).toBe('45.76357, 21.22272')
    expect(coords?.style.userSelect).toBe('all')
    const link = action?.querySelector('a')
    expect(link?.getAttribute('href')).toBe('https://wayfarer.scopely.com/mapview?z=16')
    expect(link?.getAttribute('rel')).toContain('noopener')
    expect(el.textContent).not.toContain('POIs: 0')
  })

  it('a no-data cell without coordinates still gives the instruction', () => {
    const el = buildCellPopupContent({ ...base, state: 'unknown', pois: [] })
    expect(el.querySelector('.cell-popup-action')?.textContent).toContain('this area')
    expect(el.querySelector('code')).toBeNull()
  })

  it('other states have no Wayfarer action and keep the POI count', () => {
    const el = buildCellPopupContent({ ...base, state: 'free', pois: [] })
    expect(el.querySelector('.cell-popup-action')).toBeNull()
    expect(el.textContent).toContain('POIs: 0')
  })

  it('still renders for a state it does not know (raw state only, no title)', () => {
    const el = buildCellPopupContent({ ...base, state: 'something-new', pois: [] })
    expect(el.querySelector('.cell-popup-title')).toBeNull()
    expect(el.textContent).toContain('State: something-new')
  })
})
