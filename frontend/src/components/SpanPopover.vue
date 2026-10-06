<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SpanNode } from '../lib/segment'
import { SOURCES } from '../lib/sources'
import SpanDetails from './SpanDetails.vue'

const props = defineProps<{
  node: SpanNode | null
  anchor: HTMLElement | null
}>()

const emit = defineEmits<{
  close: []
  pointerenter: []
  pointerleave: []
}>()

type PopoverElement = HTMLElement & { anchorElement: Element | null; open: boolean; reposition: () => void }

/** One shared nldd-popover, re-anchored to whichever span is active. */
const popover = ref<PopoverElement | null>(null)

watch(
  () => [props.node, props.anchor] as const,
  ([node, anchor]) => {
    const el = popover.value
    if (!el) return
    if (node && anchor) {
      el.anchorElement = anchor
      if (el.open) el.reposition()
      else el.open = true
    } else {
      el.open = false
    }
  },
  { flush: 'post' },
)
</script>

<template>
  <nldd-popover
    ref="popover"
    role="region"
    width="360px"
    placement="bottom-start"
    :accessible-label="node ? `Herkomst: ${SOURCES[node.span.source_type].label}` : 'Herkomst'"
    @close="emit('close')"
    @mouseenter="emit('pointerenter')"
    @mouseleave="emit('pointerleave')"
  >
    <SpanDetails v-if="node" :node="node" />
  </nldd-popover>
</template>
