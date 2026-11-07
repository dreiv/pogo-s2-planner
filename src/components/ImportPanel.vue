<script setup lang="ts">
import { ref } from 'vue'
import { useDatasetStore, type ImportSummary } from '../stores/dataset'
import { splitJsonDocuments } from '../core/wayfarer/split'

const dataset = useDatasetStore()
const pasteText = ref('')
const lastSummary = ref<ImportSummary | null>(null)
const importing = ref(false)
const errors = ref<string[]>([])

async function handleFileUpload(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return
  importing.value = true
  errors.value = []
  try {
    const docs: { name: string; json: unknown }[] = []
    for (const file of Array.from(files)) {
      const text = await file.text()
      const { docs: parsed, errors: splitErrors } = splitJsonDocuments(text)
      if (splitErrors.length > 0) {
        errors.value.push(...splitErrors.map((err) => `${file.name}: ${err}`))
      }
      for (const doc of parsed) {
        docs.push({ name: file.name, json: doc })
      }
    }
    if (docs.length > 0) {
      lastSummary.value = await dataset.importDocuments(docs)
    } else {
      lastSummary.value = null
    }
  } catch (err) {
    lastSummary.value = null
    errors.value.push(String(err))
    console.error('Import failed:', err)
  } finally {
    importing.value = false
    input.value = ''
  }
}

async function handlePaste(): Promise<void> {
  if (!pasteText.value.trim()) return
  importing.value = true
  errors.value = []
  try {
    const { docs, errors: splitErrors } = splitJsonDocuments(pasteText.value)
    if (splitErrors.length > 0) {
      errors.value.push(...splitErrors)
    }
    if (docs.length > 0) {
      const docsNamed = docs.map((json) => ({ name: 'pasted', json }))
      lastSummary.value = await dataset.importDocuments(docsNamed)
      pasteText.value = ''
    } else {
      lastSummary.value = null
    }
  } catch (err) {
    lastSummary.value = null
    errors.value.push(String(err))
    console.error('Import failed:', err)
  } finally {
    importing.value = false
  }
}

async function handleClear(): Promise<void> {
  if (!confirm('Delete all imported data?')) return
  await dataset.clearAll()
  lastSummary.value = null
  errors.value = []
}
</script>

<template>
  <section class="import-panel">
    <h3>Wayfarer Import</h3>

    <div class="import-actions">
      <label class="file-btn">
        <input
type="file" accept=".json,.txt,application/json" multiple :disabled="importing"
          @change="handleFileUpload" />
        <span>📂 JSON file(s)</span>
      </label>
    </div>

    <textarea
v-model="pasteText" class="paste-area" placeholder="…or paste JSON here" rows="4"
      :disabled="importing"></textarea>
    <button class="paste-btn" :disabled="importing || !pasteText.trim()" @click="handlePaste">
      {{ importing ? 'Importing…' : 'Import from text' }}
    </button>

    <!-- Errors -->
    <div v-if="errors.length > 0" class="errors">
      <h4>Errors</h4>
      <ul>
        <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
      </ul>
    </div>

    <!-- Summary -->
    <div v-if="lastSummary" class="summary">
      <h4>Import summary</h4>
      <p class="summary-line">
        +{{ lastSummary.poisAdded }} new, {{ lastSummary.poisUpdated }} updated,
        {{ lastSummary.poisRemoved }} removed, {{ lastSummary.poisUnchanged }} unchanged
        · cells +{{ lastSummary.cellsAdded }}
      </p>
      <p v-if="lastSummary.documents > 1" class="summary-line">
        {{ lastSummary.documents }} documents merged
      </p>
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

.errors {
  margin-bottom: 8px;
  padding: 8px;
  background: rgba(220, 50, 50, 0.1);
  border: 1px solid rgba(220, 50, 50, 0.3);
  border-radius: 4px;
}

.errors h4 {
  margin: 0 0 4px;
  font-size: 12px;
  color: #e05050;
}

.errors ul {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  color: #e05050;
}

.summary-line {
  font-size: 12px;
  margin: 0 0 4px;
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
