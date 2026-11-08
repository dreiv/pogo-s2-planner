<script setup lang="ts">
import { useUiStore } from '../stores/ui'
import { revealSection } from './scrollToSection'
import '../ui.css'

const ui = useUiStore()
</script>

<template>
  <div class="intro">
    <p class="tagline">
      Pick a free S17 cell on the map and track the ones you plan to nominate.
    </p>
    <div v-if="!ui.introDismissed" class="guide">
      <h3 class="guide-title">How it works</h3>
      <ol class="guide-steps">
        <li>
          A sample area is already loaded. To use your own data,
          <button type="button" class="link-btn" @click="revealSection('import')">
            import a Wayfarer export
          </button>
          (JSON).
        </li>
        <li>
          Turn on the S17 grid under <strong>Grids</strong>, then click a cell on the map. Free
          cells are untinted unless you tick “Free” in <strong>Map legend &amp; layers</strong>.
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

@media (max-width: 640px) {
  .guide {
    padding: 8px 10px;
    font-size: 12px;
  }
}
</style>
