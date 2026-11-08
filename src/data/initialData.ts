import { parseBackup, type ExportedDataset } from '../core/backup'

/**
 * Pre-populated dataset shipped with the app (a full backup, `seed/initial-backup.json`).
 * Imported lazily, so it is a separate chunk that is only fetched when the database is empty.
 * Returns null when the bundled file has no usable dataset.
 */
export async function loadInitialDataset(): Promise<ExportedDataset | null> {
  const mod = await import('./seed/initial-backup.json')
  const result = parseBackup(mod.default)
  return result.ok && result.dataset ? result.dataset : null
}
