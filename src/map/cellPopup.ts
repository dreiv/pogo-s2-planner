import L from 'leaflet'
import { buildCellPopupContent, type CellPopupData } from './cellPopupContent'

export type { CellPopupData }

export function showCellPopup(map: L.Map, latlng: L.LatLngExpression, data: CellPopupData): void {
  L.popup({ offset: [0, 0] })
    .setLatLng(latlng)
    .setContent(buildCellPopupContent(data))
    .openOn(map)
}
