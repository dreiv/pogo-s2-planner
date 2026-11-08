// DOM nodes + textContent only (no innerHTML): POI titles are community-contributed text.
export interface CellPopupData {
  s17Token: string
  s14Token: string
  state: string
  pois: { id: string; title: string }[]
}

function line(label: string, value: string): HTMLElement {
  const row = document.createElement('div')
  const strong = document.createElement('strong')
  strong.textContent = `${label}:`
  row.appendChild(strong)
  row.appendChild(document.createTextNode(` ${value}`))
  return row
}

export function buildCellPopupContent(data: CellPopupData): HTMLElement {
  const root = document.createElement('div')
  root.className = 'cell-popup'
  root.appendChild(line('S17', data.s17Token))
  root.appendChild(line('S14', data.s14Token))
  root.appendChild(line('State', data.state))
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
  return root
}
