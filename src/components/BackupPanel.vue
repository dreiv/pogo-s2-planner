<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import '../ui.css'
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
    showRange: settings.showRange,
    rangeRadius: settings.rangeRadius,
    rangeCenter: settings.rangeCenter,
    showRangeRings: settings.showRangeRings,
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
  settings.showRange = s.showRange
  settings.setRangeRadius(s.rangeRadius)
  settings.setRangeCenter(s.rangeCenter)
  settings.showRangeRings = s.showRangeRings

  message.value = `Imported: ${result.marks.length} mark(s), settings restored.`
  error.value = ''

  // Reset input so same file can be re-imported
  input.value = ''
}
</script>

<template>
  <CollapsibleSection id="backup" title="Backup / export">
    <div class="backup-actions">
      <button class="ui-btn ui-btn--block ui-btn--primary" @click="exportMarks">
        <span aria-hidden="true">⬇</span> Export marks + settings (safe to share)
      </button>
      <button class="ui-btn ui-btn--block btn-warn" @click="exportWithDataset">
        <span aria-hidden="true">⬇</span> Export everything incl. Wayfarer data (private, do not commit)
      </button>
      <label class="ui-btn ui-btn--block import-label">
        <input type="file" accept="application/json,.json" @change="importFromInput" />
        <span><span aria-hidden="true">⬆</span> Import backup file</span>
      </label>
    </div>

    <p v-if="message" class="msg" role="status">{{ message }}</p>
    <p v-if="error" class="msg error" role="alert">{{ error }}</p>

    <p class="backup-note">
      The first export has no Wayfarer data. The second one includes your Wayfarer (Niantic) data, which is personal.
      Keep it out of version control.
    </p>
  </CollapsibleSection>
</template>

<style scoped>
.backup-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 4px 0;
}

.btn-warn {
  border-color: var(--accent-amber);
  background: var(--accent-amber-bg);
  color: var(--accent-amber-text);
}

.btn-warn:hover:not(:disabled) {
  background: var(--accent-amber-bg-hover);
}

.import-label {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.import-label input[type='file'] {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.import-label:focus-within {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.msg {
  margin: 6px 0;
  font-size: 13px;
  color: var(--text-success);
}

.msg.error {
  color: var(--accent-red-text);
}

.backup-note {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--text-secondary);
}
</style>
