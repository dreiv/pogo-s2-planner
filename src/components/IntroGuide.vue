<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import { revealSection } from './scrollToSection'
import '../ui.css'

const ui = useUiStore()
</script>

<template>
  <div class="intro">
    <p class="tagline">
      Find S14 cells where one more stop unlocks a gym, then pick a free S17 cell to nominate in.
    </p>
    <div v-if="!ui.introDismissed" class="guide">
      <h3 class="guide-title">How it works</h3>
      <ol class="guide-steps">
        <li>
          <button type="button" class="link-btn" @click="revealSection('import')">
            Import your Wayfarer data
          </button>
          (a JSON export).
        </li>
        <li>
          Pick a cell in the <strong>S14 statistics</strong> table, or click a free cell on the map
          (turn on the S17 grid).
        </li>
        <li>Track it under <strong>Manual marks</strong>.</li>
      </ol>
      <button type="button" class="ui-btn" @click="ui.dismissIntro()">Got it</button>
    </div>
    <button v-else type="button" class="link-btn" @click="ui.showIntro()">Show guide</button>
  </div>
</template>

<style scoped>
.intro {
  margin-bottom: 16px;
}

.tagline {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-secondary);
}

.guide {
  padding: 10px 12px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-subtle);
  font-size: 13px;
  line-height: 1.4;
}

.guide-title {
  margin: 0 0 6px;
  font-size: 13px;
}

.guide-steps {
  margin: 0 0 10px;
  padding-left: 20px;
}

.guide-steps li {
  margin-bottom: 4px;
}
</style>
