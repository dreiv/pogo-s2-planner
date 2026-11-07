/**
 * Cell popup helper — shows a popup with S17 cell details.
 */
import L from 'leaflet'

export interface CellPopupData {
  s17Token: string
  s14Token: string
  state: string
  pois: { id: string; title: string }[]
}

export function showCellPopup(map: L.Map, latlng: L.LatLngExpression, data: CellPopupData): void {
  const poiList =
    data.pois.length > 0
      ? `<ul style="margin:4px 0;padding-left:16px">${data.pois
          .map((p) => `<li>${p.title || p.id}</li>`)
          .join('')}</ul>`
      : ''

  const html = `
    <div style="font-size:12px;line-height:1.5">
      <strong>S17:</strong> ${data.s17Token}<br>
      <strong>S14:</strong> ${data.s14Token}<br>
      <strong>State:</strong> ${data.state}<br>
      <strong>POIs:</strong> ${data.pois.length}
      ${poiList}
    </div>
  `

  L.popup({ offset: [0, 0] })
    .setLatLng(latlng)
    .setContent(html)
    .openOn(map)
}
