/**
 * S14 stats popup helper.
 */
import L from 'leaflet'
import type { S14Stats } from '../core/stats'

/**
 * Show a popup with S14 statistics at the given location.
 */
export function showS14StatsPopup(map: L.Map, latlng: L.LatLngExpression, stats: S14Stats): void {
  const html = `
    <div style="font-size:12px;line-height:1.5">
      <strong>S14: ${stats.token.slice(-8)}</strong>
      <br/>
      Stop: ${stats.stopCount} | Gym: ${stats.gymCount} | Total: ${stats.totalPoi}
      <br/>
      Est. gyms: ${stats.expectedGyms}
      <br/>
      Still needed: ${stats.poiToNextThreshold} POI
      <br/>
      Free S17: ${stats.freeS17Count}/64
      ${stats.truncated ? '<br/><em style="color:#92400e">⚠ S14 truncated</em>' : ''}
    </div>
  `
  const popup = L.popup({ maxWidth: 280 }).setLatLng(latlng).setContent(html)
  map.openPopup(popup)
}
