<script setup lang="ts">
import { ref } from 'vue'
import { useDatasetStore, type ImportSummary } from '../stores/dataset'

const dataset = useDatasetStore()
const pasteText = ref('')
const lastSummary = ref<ImportSummary | null>(null)
const importing = ref(false)

async function handleFileUpload(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    lastSummary.value = await dataset.importFromJson(json, file.name)
  } catch (err) {
    lastSummary.value = null
    console.error('Import failed:', err)
  } finally {
    importing.value = false
    input.value = ''
  }
}

async function handlePaste(): Promise<void> {
  if (!pasteText.value.trim()) return
  importing.value = true
  try {
    const json = JSON.parse(pasteText.value)
    lastSummary.value = await dataset.importFromJson(json, 'pasted')
    pasteText.value = ''
  } catch (err) {
    lastSummary.value = null
    console.error('Import failed:', err)
  } finally {
    importing.value = false
  }
}

async function handleClear(): Promise<void> {
  if (!confirm('Delete all imported data?')) return
  await dataset.clearAll()
  lastSummary.value = null
}
</script>

<template>
  <section class="import-panel">
    <h3>Wayfarer Import</h3>

    <div class="import-actions">
      <label class="file-btn">
        <input type="file" accept=".json" :disabled="importing" @change="handleFileUpload" />
        <span>📂 JSON file</span>
      </label>
    </div>

    <textarea
v-model="pasteText" class="paste-area" placeholder="…or paste JSON here" rows="4"
      :disabled="importing"></textarea>
    <button class="paste-btn" :disabled="importing || !pasteText.trim()" @click="handlePaste">
      {{ importing ? 'Importing…' : 'Import from text' }}
    </button>

    <!-- Summary -->
    <div v-if="lastSummary" class="summary">
      <h4>Import summary</h4>
      <dl>
        <dt>POIs</dt>
        <dd>{{ lastSummary.poiCount }}</dd>
        <dt>Pokéstop</dt>
        <dd>{{ lastSummary.stopCount }}</dd>
        <dt>Gym</dt>
        <dd>{{ lastSummary.gymCount }}</dd>
        <dt>Power Spot</dt>
        <dd>{{ lastSummary.powerSpotCount }}</dd>
        <dt>No GMO</dt>
        <dd>{{ lastSummary.noGmoCount }}</dd>
        <dt>Cells</dt>
        <dd>{{ lastSummary.cellCount }}</dd>
        <dt>Truncated cells</dt>
        <dd>{{ lastSummary.truncatedCount }}</dd>
        <dt>Warnings</dt>
        <dd>{{ lastSummary.warningCount }}</dd>
      </dl>
    </div>

    <!-- Import history -->
    <div v-if="dataset.imports.length > 0" class="imports-list">
      <h4>Imports</h4>
      <ul>
        <li v-for="imp in dataset.imports" :key="imp.id">
          {{ imp.fileName }} — {{ imp.poiCount }} POIs, {{ imp.cellCount }} cells
        </li>
      </ul>
    </div>

    <!-- Clear -->
    <button v-if="dataset.pois.length > 0" class="clear-btn" @click="handleClear">
      Delete all data
    </button>
  </section>
</template>

<style scoped>
.import-panel {
  margin-bottom: 16px;
}

.import-panel h3 {
  font-size: 13px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin: 0 0 8px;
}

.import-actions {
  margin-bottom: 8px;
}

.file-btn {
  display: inline-block;
  padding: 6px 12px;
  background: var(--bg-hover);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.file-btn input {
  display: none;
}

.paste-area {
  width: 100%;
  font-family: monospace;
  font-size: 11px;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px;
  resize: vertical;
  margin-bottom: 8px;
  background: var(--bg-app);
  color: var(--text-primary);
}

.paste-btn {
  width: 100%;
  padding: 6px;
  background: var(--accent-blue);
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 12px;
}

.paste-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.summary {
  background: var(--bg-subtle);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 13px;
}

.summary h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--text-secondary);
}

.summary dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 12px;
  margin: 0;
}

.summary dt {
  color: var(--text-secondary);
}

.summary dd {
  margin: 0;
  font-weight: 600;
}

.imports-list {
  margin-bottom: 12px;
  font-size: 12px;
}

.imports-list h4 {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 4px;
}

.imports-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.imports-list li {
  padding: 2px 0;
  font-size: 11px;
}

.clear-btn {
  width: 100%;
  padding: 6px;
  font-size: 12px;
  border: 1px solid var(--accent-red);
  border-radius: 4px;
  background: var(--bg-panel);
  color: var(--accent-red);
  cursor: pointer;
}

.clear-btn:hover {
  background: var(--accent-red-bg);
}
</style>
