// Colors for data-driven map elements. Surface colors live in theme.css.

export const POI_COLORS = {
  stop: '#3b82f6',
  gym: '#ef4444',
  powerspot: '#f59e0b',
  other: '#9ca3af'
} as const

export const CELL_STATE_COLORS = {
  occupied: '#ef4444',
  free: '#22c55e',
  'free-uncertain': '#f59e0b',
  unknown: 'transparent'
} as const

export const MARK_STATUS_COLORS = {
  planificat: '#2563eb',
  propus: '#7c3aed',
  'in-review': '#0891b2',
  respins: '#db2777',
  aprobat: '#0f766e'
} as const

export const LOCATION_COLORS = {
  marker: '#2196f3',
  accuracy: '#4a90d9'
} as const

export const GRID_STROKE = {
  s14: '#3b82f6',
  s17: '#9ca3af'
} as const

export const RANGE_COLORS = {
  circle: '#3b82f6',
  s17Outline: '#ef4444',
  s14Outline: '#3b82f6'
} as const

/** `#rrggbb` -> `rgba()`; non-hex values (e.g. `transparent`) pass through. */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return color
}
