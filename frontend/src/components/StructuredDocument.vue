<script setup lang="ts">
import SegmentList from './SegmentList.vue'
import type { LayoutBlock } from '../lib/structure'

// The card's own title is the h2, so the document's title is an h3, its
// sections h4 and its questions h5: a screen reader can jump from question to
// question. Provenance marks render inside each block exactly as in running text.
defineProps<{ blocks: LayoutBlock[] }>()
</script>

<!-- Each SegmentList stays on the same line as its tags: whitespace there
     would end up in the heading or paragraph text. -->
<template>
  <template v-for="block in blocks" :key="block.key">
    <nldd-title v-if="block.role === 'title'" size="3" class="to-block to-block--title"><h3><SegmentList :segments="block.segments" :inside-highlight="false" /></h3></nldd-title>
    <p v-else-if="block.role === 'subtitle'" class="to-block to-block--subtitle"><SegmentList :segments="block.segments" :inside-highlight="false" /></p>
    <nldd-title v-else-if="block.role === 'section'" size="4" class="to-block to-block--section"><h4><SegmentList :segments="block.segments" :inside-highlight="false" /></h4></nldd-title>
    <h5 v-else-if="block.role === 'question'" class="to-block to-block--question"><SegmentList :segments="block.segments" :inside-highlight="false" /></h5>
    <p v-else class="to-block to-block--answer"><SegmentList :segments="block.segments" :inside-highlight="false" /></p>
  </template>
</template>
