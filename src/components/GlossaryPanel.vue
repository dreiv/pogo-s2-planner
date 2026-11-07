<script setup lang="ts">
import CollapsibleSection from './CollapsibleSection.vue'
import { GLOSSARY } from '../glossary'
</script>

<template>
  <CollapsibleSection id="glossary" title="Glossary">
    <dl class="glossary">
      <template v-for="term in GLOSSARY" :key="term.id">
        <dt>{{ term.label }}</dt>
        <dd>{{ term.text }}</dd>
      </template>
    </dl>
  </CollapsibleSection>
</template>

<style scoped>
.glossary {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.glossary dt {
  margin-top: 10px;
  font-weight: 600;
}

.glossary dt:first-child {
  margin-top: 0;
}

.glossary dd {
  margin: 2px 0 0;
  color: var(--text-secondary);
}
</style>
