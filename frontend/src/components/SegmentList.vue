<script setup lang="ts">
import { inject } from 'vue'
import { splitGap, type Segment, type SpanNode } from '../lib/segment'
import { spanContextKey } from '../lib/spanContext'
import { SOURCES, UNKNOWN_LABEL } from '../lib/sources'

const props = defineProps<{
  segments: Segment[]
  /** True when a highlighted ancestor already paints a background. */
  insideHighlight: boolean
  /** True below any span, shown or filtered out: its gaps belong to that span, not to "unknown". */
  owned?: boolean
  /** True inside a span that a replay has not reached yet; only the outermost one is labelled. */
  inFuture?: boolean
}>()

const ctx = inject(spanContextKey)!

const isShown = ctx.isShown

/** A top-level gap with text in it, to be marked as unknown provenance; null when it stays plain. */
function unknownGap(text: string) {
  if (props.owned || !ctx.visible.value.none) return null
  const gap = splitGap(text)
  return gap.core ? gap : null
}

function classes(node: SpanNode) {
  // Never stack backgrounds: the outermost visible span is filled, nested ones are underlined.
  const style = props.insideHighlight ? 'underline' : 'fill'
  return [
    'to-span',
    `to-span--${node.span.source_type}`,
    `to-span--${style}`,
    { 'is-active': ctx.activeId.value === node.id, 'is-current': ctx.isCurrent(node) },
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
    <template v-if="seg.kind === 'text'">
      <template v-if="unknownGap(seg.text)">
        <span>{{ unknownGap(seg.text)!.lead }}</span>
        <mark class="to-span to-span--none to-span--fill">
          <span class="to-visually-hidden">[{{ UNKNOWN_LABEL }}: </span>
          <span>{{ unknownGap(seg.text)!.core }}</span>
          <span class="to-visually-hidden">]</span>
        </mark>
        <span>{{ unknownGap(seg.text)!.trail }}</span>
      </template>
      <span v-else>{{ seg.text }}</span>
    </template>
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
      <SegmentList :segments="seg.children" :inside-highlight="true" owned :in-future="inFuture" />
      <span class="to-visually-hidden">]</span>
    </mark>
    <!-- Not written yet at this replay step: the final text, greyed and slanted, without a mark. -->
    <span v-else-if="ctx.isFuture(seg.node) && !inFuture" class="to-future">
      <span class="to-visually-hidden">[Nog niet geschreven: </span>
      <SegmentList :segments="seg.children" :inside-highlight="insideHighlight" owned in-future />
      <span class="to-visually-hidden">]</span>
    </span>
    <!-- A source that is filtered out keeps its text but loses its mark and tooltip. -->
    <SegmentList v-else :segments="seg.children" :inside-highlight="insideHighlight" owned :in-future="inFuture" />
  </template>
</template>
