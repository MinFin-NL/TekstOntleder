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

type PopoverElement = HTMLElement & { anchorElement: Element | null; show: () => void; hide: () => void; reposition: () => void }

/** One shared nldd-popover, re-anchored to whichever span is active. */
const popover = ref<PopoverElement | null>(null)

watch(
  () => [props.node, props.anchor] as const,
  ([node, anchor]) => {
    const el = popover.value
    if (!el) return
    // Ask the element itself, not its `open` property: a click on another
    // fragment light-dismisses the popover before this runs, and `open` only
    // catches up when the toggle event arrives.
    const showing = el.matches(':popover-open')
    if (node && anchor) {
      el.anchorElement = anchor
      if (showing) el.reposition()
      else el.show()
    } else if (showing) {
      el.hide()
    }
  },
  { flush: 'post' },
)

// A close that arrives after the popover was reopened for another fragment is stale.
function onClose() {
  if (!popover.value?.matches(':popover-open')) emit('close')
}
</script>

<template>
  <nldd-popover
    ref="popover"
    role="region"
    width="360px"
    placement="bottom-start"
    :accessible-label="node ? `Herkomst: ${SOURCES[node.span.source_type].label}` : 'Herkomst'"
    @close="onClose"
    @mouseenter="emit('pointerenter')"
    @mouseleave="emit('pointerleave')"
  >
    <SpanDetails v-if="node" :node="node" />
  </nldd-popover>
</template>
