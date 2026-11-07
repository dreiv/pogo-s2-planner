import type { MarkStatus } from './data/db'

export const MARK_STATUS_ORDER: MarkStatus[] = [
  'planificat',
  'propus',
  'in-review',
  'respins',
  'aprobat'
]

export const MARK_STATUS_LABELS: Record<MarkStatus, string> = {
  planificat: 'Planned',
  propus: 'Proposed',
  'in-review': 'In review',
  respins: 'Rejected',
  aprobat: 'Approved'
}

export const MARK_STATUS_DASH: Record<MarkStatus, string | undefined> = {
  planificat: '3 6',
  propus: '10 5',
  'in-review': '10 4 2 4',
  respins: '2 2',
  aprobat: undefined
}

export const MARK_OUTLINE_WEIGHT = 3
