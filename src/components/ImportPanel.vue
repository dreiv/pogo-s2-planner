<script setup lang="ts">
import { ref } from 'vue'
import CollapsibleSection from './CollapsibleSection.vue'
import InfoTip from './InfoTip.vue'
import { useDatasetStore, type ImportSummary } from '../stores/dataset'
import { splitJsonDocuments } from '../core/wayfarer/split'
import '../ui.css'

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

function formatTime(ts: number): string {
  return Number.isFinite(ts) && ts > 0 ? new Date(ts).toLocaleString() : 'unknown time'
}
</script>

<template>
  <CollapsibleSection id="import" title="Wayfarer import">
    <p class="hint">
      Load your Wayfarer data first. Nothing else on this panel works without it.
      <InfoTip term="importMerge" />
    </p>

    <details class="how-to">
      <summary>How to get the Wayfarer JSON</summary>
      <ol>
        <li>
          Open <a href="https://wayfarer.pokemon-go.community/" target="_blank" rel="noopener">Wayfarer</a>
          in your browser.
        </li>
        <li>Open DevTools and switch to the Network tab.</li>
        <li>Search or select the area you want in Wayfarer.</li>
        <li>In the Network tab, open the data request (usually search or query) and copy its Response (JSON).</li>
        <li>Paste it below, or save it as a file and load it.</li>
      </ol>
    </details>

    <label class="ui-btn ui-btn--block file-btn">
      <input
        type="file" accept=".json,.txt,application/json" multiple :disabled="importing"
        @change="handleFileUpload" />
      <span>📂 Load JSON file(s)</span>
    </label>

    <label class="field-label" for="wf-paste">…or paste JSON</label>
    <textarea
      id="wf-paste" v-model="pasteText" class="paste-area" placeholder="Paste Wayfarer JSON here" rows="4"
      :disabled="importing" aria-describedby="wf-paste-hint"></textarea>
    <button
      class="ui-btn ui-btn--primary ui-btn--block" :disabled="importing || !pasteText.trim()"
      @click="handlePaste">
      {{ importing ? 'Importing…' : 'Import from text' }}
    </button>
    <p v-if="!pasteText.trim() && !importing" id="wf-paste-hint" class="hint">Paste JSON to enable this button.</p>

    <div v-if="errors.length > 0" class="errors" role="alert">
      <h4>Errors</h4>
      <ul>
        <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
      </ul>
    </div>

    <div v-if="lastSummary" class="summary" aria-live="polite">
      <h4>Import summary</h4>
      <p class="summary-line">
        +{{ lastSummary.poisAdded }} new, {{ lastSummary.poisUpdated }} updated,
        {{ lastSummary.poisRemoved }} removed <InfoTip term="removed" />, {{ lastSummary.poisUnchanged }} unchanged
        · cells +{{ lastSummary.cellsAdded }}
      </p>
      <p v-if="lastSummary.documents > 1" class="summary-line">
        {{ lastSummary.documents }} documents merged
      </p>
      <dl>
        <dt>POIs</dt>
        <dd>{{ lastSummary.poiCount }}</dd>
        <dt>Pokéstops</dt>
        <dd>{{ lastSummary.stopCount }}</dd>
        <dt>Gyms</dt>
        <dd>{{ lastSummary.gymCount }}</dd>
        <dt>Power Spots</dt>
        <dd>{{ lastSummary.powerSpotCount }}</dd>
        <dt>Non-game POIs</dt>
        <dd>{{ lastSummary.noGmoCount }}</dd>
        <dt>S14 cells</dt>
        <dd>{{ lastSummary.cellCount }}</dd>
        <dt>Incomplete cells</dt>
        <dd>{{ lastSummary.truncatedCount }}</dd>
        <dt>Warnings</dt>
        <dd>{{ lastSummary.warningCount }}</dd>
      </dl>
    </div>

    <div v-if="dataset.imports.length > 0" class="imports-list">
      <h4>Import history</h4>
      <ul>
        <li v-for="imp in dataset.imports" :key="imp.id">
          <span class="imp-name">{{ imp.fileName }}</span>
          <span class="imp-meta">{{ formatTime(imp.importedAt) }} · {{ imp.poiCount }} POIs, {{ imp.cellCount }} cells</span>
        </li>
      </ul>
      <p class="hint">Imports merge into your existing data; they do not replace it.</p>
    </div>
  </CollapsibleSection>
</template>

<style scoped>
.hint {
  margin: 8px 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.how-to {
  margin: 8px 0;
  font-size: 13px;
}

.how-to summary {
  min-height: 24px;
  cursor: pointer;
}

.how-to ol {
  margin: 6px 0 0;
  padding-left: 20px;
  line-height: 1.4;
}

.file-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  overflow: hidden;
  cursor: pointer;
}

.file-btn input {
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.file-btn:focus-within {
  outline: 2px solid var(--accent-blue);
  outline-offset: 2px;
}

.field-label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
}

.paste-area {
  width: 100%;
  margin-bottom: 8px;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-app);
  color: var(--text-primary);
  font-family: monospace;
  font-size: 12px;
  resize: vertical;
}

.errors {
  margin: 8px 0;
  padding: 8px;
  border: 1px solid rgba(220, 50, 50, 0.3);
  border-radius: 4px;
  background: rgba(220, 50, 50, 0.1);
  font-size: 13px;
}

.errors h4,
.summary h4,
.imports-list h4 {
  margin: 0 0 4px;
  font-size: 13px;
}

.errors ul,
.imports-list ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary {
  margin: 8px 0;
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-subtle);
  font-size: 13px;
}

.summary-line {
  margin: 4px 0;
}

.summary dl {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2px 8px;
  margin: 6px 0 0;
}

.summary dt {
  color: var(--text-secondary);
}

.summary dd {
  margin: 0;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.imports-list {
  margin-top: 12px;
}

.imports-list li {
  display: flex;
  flex-direction: column;
  padding: 4px 0;
  border-bottom: 1px solid var(--border-subtle);
  font-size: 13px;
}

.imp-meta {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
