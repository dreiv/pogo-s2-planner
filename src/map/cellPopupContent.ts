// DOM nodes + textContent only (no innerHTML): POI titles are community-contributed text.
import { CELL_STATE_TITLES, cellStateExplanation } from '../cellStateText'
import type { CellState } from '../core/classify'

export interface CellPopupData {
  s17Token: string
  s14Token: string
  state: string
  pois: { id: string; title: string }[]
  /** POI count Wayfarer reported for the parent S14 cell, when that cell is in the data. */
  s14PoiCount?: number | null
  /** Where the person clicked: shown on "No data" cells so they know which area to search. */
  lat?: number
  lng?: number
  /** "This S14 cell has 5 stops and gyms. With 1 more stop..." (when a gym is about to appear). */
  gymHint?: string | null
}

export const WAYFARER_URL = 'https://wayfarer.scopely.com/mapview?z=16'

/**
 * Hint with a Wayfarer link, shown on "No data" cells. The coordinates sit in their own block
 * that selects in one tap/click (user-select: all), so they can be pasted into Wayfarer's search.
 */
function noDataAction(lat?: number, lng?: number): HTMLElement {
  const box = document.createElement('div')
  box.className = 'cell-popup-action'
  box.style.margin = '0 0 6px'

  const hasCoords = typeof lat === 'number' && typeof lng === 'number'
  const p = document.createElement('p')
  p.style.margin = '0 0 4px'
  p.appendChild(document.createTextNode('To fill it in, open '))
  const a = document.createElement('a')
  a.href = WAYFARER_URL
  a.target = '_blank'
  a.rel = 'noopener'
  a.textContent = 'Wayfarer'
  p.appendChild(a)
  p.appendChild(
    document.createTextNode(
      `, search ${hasCoords ? 'these coordinates' : 'this area'} and import the response in the Import panel.`
    )
  )
  box.appendChild(p)

  if (hasCoords) {
    const code = document.createElement('code')
    code.className = 'cell-popup-coords'
    code.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    code.title = 'Click to select, then copy'
    code.style.display = 'block'
    code.style.userSelect = 'all'
    code.style.padding = '4px 6px'
    code.style.borderRadius = '4px'
    code.style.background = 'rgba(127, 127, 127, 0.18)'
    code.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
    box.appendChild(code)
  }
  return box
}

function line(label: string, value: string): HTMLElement {
  const row = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = `${label}:`
  row.appendChild(strong)
  row.appendChild(document.createTextNode(` ${value}`))
  return row
}

function isCellState(s: string): s is CellState {
  return s in CELL_STATE_TITLES
}

export function buildCellPopupContent(data: CellPopupData): HTMLElement {
  const root = document.createElement('div')
  root.className = 'cell-popup'

  // Plain-language summary first; raw S2 tokens are tucked under "Details".
  if (isCellState(data.state)) {
    const title = document.createElement('strong')
    title.className = 'cell-popup-title'
    title.textContent = CELL_STATE_TITLES[data.state]
    root.appendChild(title)

    const why = document.createElement('p')
    why.className = 'cell-popup-why'
    why.style.margin = '4px 0 6px'
    why.textContent = cellStateExplanation(data.state, data.s14PoiCount)
    root.appendChild(why)
    if (data.state === 'unknown') root.appendChild(noDataAction(data.lat, data.lng))
  }

  if (data.gymHint) {
    const hint = document.createElement('p')
    hint.className = 'cell-popup-gym-hint'
    hint.style.margin = '0 0 6px'
    hint.textContent = data.gymHint
    root.appendChild(hint)
  }

  // "POIs: 0" would read as "checked, nothing there" on a cell the app knows nothing about.
  if (data.state !== 'unknown') root.appendChild(line('POIs', String(data.pois.length)))

  if (data.pois.length > 0) {
    const list = document.createElement('ul')
    list.className = 'cell-popup-pois'
    for (const poi of data.pois) {
      const item = document.createElement('li')
      item.textContent = poi.title || poi.id
      list.appendChild(item)
    }
    root.appendChild(list)
  }

  const details = document.createElement('details')
  details.className = 'cell-popup-details'
  const summary = document.createElement('summary')
  summary.textContent = 'Details'
  details.appendChild(summary)
  details.appendChild(line('S17', data.s17Token))
  details.appendChild(line('S14', data.s14Token))
  details.appendChild(line('State', data.state))
  root.appendChild(details)
  return root
}
