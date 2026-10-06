<script setup lang="ts">
import { inject } from 'vue'
import type { Segment, SpanNode } from '../lib/segment'
import { spanContextKey } from '../lib/spanContext'
import { SOURCES } from '../lib/sources'

const props = defineProps<{
  segments: Segment[]
  /** True when a highlighted ancestor already paints a background. */
  insideHighlight: boolean
}>()

const ctx = inject(spanContextKey)!

const isShown = (node: SpanNode) => ctx.visible.value[node.span.source_type]

function classes(node: SpanNode) {
  // Never stack backgrounds: the outermost visible span is filled, nested ones are underlined.
  const style = props.insideHighlight ? 'underline' : 'fill'
  return [
    'to-span',
    `to-span--${node.span.source_type}`,
    `to-span--${style}`,
    { 'is-active': ctx.activeId.value === node.id },
  ]
}

function onOver(node: SpanNode, e: MouseEvent) {
  // Stop at the innermost span so a nested child overrides its parent.
  e.stopPropagation()
  ctx.onHover(node, e.currentTarget as HTMLElement)
}

function onClick(node: SpanNode, e: MouseEvent) {
  e.stopPropagation()
  ctx.onActivate(node, e.currentTarget as HTMLElement)
}

function onKey(node: SpanNode, e: KeyboardEvent) {
  if (e.target !== e.currentTarget) return
  e.preventDefault()
  ctx.onActivate(node, e.currentTarget as HTMLElement)
}
</script>

<!-- Whitespace between tags matters in running text: keep every node on its
     own line so the compiler's whitespace condensing drops the newlines. -->
<template>
  <template v-for="seg in segments" :key="seg.kind === 'text' ? `t${seg.start}` : seg.node.id">
    <span v-if="seg.kind === 'text'">{{ seg.text }}</span>
    <mark
      v-else-if="isShown(seg.node)"
      :id="`span-${seg.node.id}`"
      :class="classes(seg.node)"
      tabindex="0"
      @mouseover="onOver(seg.node, $event)"
      @mouseleave="ctx.onLeave()"
      @click="onClick(seg.node, $event)"
      @keydown.enter="onKey(seg.node, $event)"
      @keydown.space="onKey(seg.node, $event)"
    >
      <span class="to-visually-hidden">[{{ SOURCES[seg.node.span.source_type].label }}: </span>
      <SegmentList :segments="seg.children" :inside-highlight="true" />
      <span class="to-visually-hidden">]</span>
    </mark>
    <!-- A source that is filtered out keeps its text but loses its mark and tooltip. -->
    <SegmentList v-else :segments="seg.children" :inside-highlight="insideHighlight" />
  </template>
</template>
