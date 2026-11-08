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
  }

  root.appendChild(line('POIs', String(data.pois.length)))

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
