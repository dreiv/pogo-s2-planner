<script setup lang="ts">
import { ref } from 'vue'
import { useMarksStore } from '../stores/marks'
import { useSettingsStore } from '../stores/settings'
import { useDatasetStore } from '../stores/dataset'
import { buildBackup, parseBackup, type ExportedMark, type ExportedSettings } from '../core/backup'
import type { CellMark } from '../data/db'

const marks = useMarksStore()
const settings = useSettingsStore()
const dataset = useDatasetStore()

const message = ref('')
const error = ref('')

function collectSettings(): ExportedSettings {
  return {
    center: settings.center,
    zoom: settings.zoom,
    showS14: settings.showS14,
    showS17: settings.showS17,
    s14MinZoom: settings.s14MinZoom,
    s17MinZoom: settings.s17MinZoom,
    showPois: settings.showPois,
    showOtherPois: settings.showOtherPois,
    stopGymOnly: settings.stopGymOnly,
    powerspotCounts: settings.powerspotCounts,
    showRange: settings.showRange,
    rangeRadius: settings.rangeRadius,
    rangeCenter: settings.rangeCenter,
    showRangeRings: settings.showRangeRings,
    showS14Stats: settings.showS14Stats,
    showPoiImages: settings.showPoiImages
  }
}

function collectMarks(): ExportedMark[] {
  return marks.marks.map((m: CellMark) => ({
    token17: m.token17,
    status: m.status,
    note: m.note,
    updatedAt: m.updatedAt
  }))
}

function download(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportMarks(): void {
  const file = buildBackup(collectMarks(), collectSettings())
  download('pogo-s2-backup.json', file)
  message.value = 'Exported: marks + settings.'
  error.value = ''
}

function exportWithDataset(): void {
  const file = buildBackup(collectMarks(), collectSettings(), {
    pois: dataset.pois,
    cells: dataset.cells
  })
  download('pogo-s2-backup-full.json', file)
  message.value = 'Exported: marks + settings + dataset. ⚠ Do not commit personal data.'
  error.value = ''
}

async function importFromInput(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const text = await file.text()
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    error.value = 'Invalid JSON — file could not be read.'
    message.value = ''
    return
  }

  const result = parseBackup(raw)
  if (!result.ok) {
    error.value = result.error ?? 'Import failed.'
    message.value = ''
    return
  }

  // Apply marks
  await marks.bulkSet(
    result.marks.map((m) => ({
      token17: m.token17,
      status: m.status,
      note: m.note,
      updatedAt: m.updatedAt
    }))
  )

  // Apply settings
  const s = result.settings
  settings.setCenter(s.center)
  settings.setZoom(s.zoom)
  // Toggles: set directly via store state
  settings.showS14 = s.showS14
  settings.showS17 = s.showS17
  settings.s14MinZoom = s.s14MinZoom
  settings.s17MinZoom = s.s17MinZoom
  settings.showPois = s.showPois
  settings.showOtherPois = s.showOtherPois
  settings.stopGymOnly = s.stopGymOnly
  settings.powerspotCounts = s.powerspotCounts
  settings.showRange = s.showRange
  settings.setRangeRadius(s.rangeRadius)
  settings.setRangeCenter(s.rangeCenter)
  settings.showRangeRings = s.showRangeRings
  settings.showS14Stats = s.showS14Stats

  message.value = `Imported: ${result.marks.length} mark(s), settings restored.`
  error.value = ''

  // Reset input so same file can be re-imported
  input.value = ''
}
</script>

<template>
  <section class="panel-section">
    <h3>Backup / Export</h3>

    <div class="backup-actions">
      <button class="btn" @click="exportMarks">
        ⬇ Export marks + settings
      </button>
      <button class="btn btn-warn" @click="exportWithDataset">
        ⬇ Export + dataset (⚠ personal)
      </button>
    </div>

    <label class="import-label">
      <span>⬆ Import backup</span>
      <input type="file" accept="application/json,.json" @change="importFromInput" />
    </label>

    <p v-if="message" class="msg">{{ message }}</p>
    <p v-if="error" class="msg error">{{ error }}</p>

    <p class="backup-note">
      The default export does NOT include Wayfarer data. The second button also includes the
      dataset (personal/Niantic data — do not commit it).
    </p>
  </section>
</template>

<style scoped>
.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 6px 0;
}

.btn {
  font-size: 12px;
  padding: 6px 10px;
  border: 1px solid var(--accent-blue);
  border-radius: 4px;
  background: var(--accent-blue-bg);
  color: var(--accent-blue-text);
  cursor: pointer;
  text-align: left;
}

.btn:hover {
  background: var(--accent-blue-bg-hover);
}

.btn-warn {
  border-color: var(--accent-amber);
  background: var(--accent-amber-bg);
  color: var(--accent-amber-text);
}

.btn-warn:hover {
  background: var(--accent-amber-bg-hover);
}

.import-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  margin: 6px 0;
  cursor: pointer;
}

.import-label input[type='file'] {
  font-size: 11px;
}

.msg {
  font-size: 11px;
  color: var(--text-success);
  margin: 4px 0;
}

.msg.error {
  color: var(--accent-red-text);
}

.backup-note {
  font-size: 10px;
  color: var(--text-secondary);
  margin: 6px 0 0;
  line-height: 1.3;
}
</style>
