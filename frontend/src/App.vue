<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import FilterPanel from './components/FilterPanel.vue'
import SegmentList from './components/SegmentList.vue'
import SpanPopover from './components/SpanPopover.vue'
import { attributionStats, buildSpanTree, segmentText, type SpanNode } from './lib/segment'
import { spanContextKey } from './lib/spanContext'
import type { LJSONDocument, SourceType } from './types/ljson'

const HOVER_OPEN_MS = 150
const HOVER_CLOSE_MS = 250

const variant = new URLSearchParams(window.location.search).get('voorbeeld') === 'genest' ? 'nested' : 'example'

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; doc: LJSONDocument }

interface Active {
  node: SpanNode
  anchor: HTMLElement
  /** Opened by click or keyboard: stays open until dismissed, ignores hover. */
  pinned: boolean
}

const load = shallowRef<LoadState>({ status: 'loading' })
const visible = ref<Record<SourceType, boolean>>({ human: true, ai: true, copied: true })
const active = shallowRef<Active | null>(null)

const controller = new AbortController()
onMounted(async () => {
  try {
    const res = await fetch(`/api/document?variant=${variant}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`De server gaf status ${res.status}.`)
    load.value = { status: 'ready', doc: (await res.json()) as LJSONDocument }
  } catch (err) {
    if (controller.signal.aborted) return
    load.value = { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
})

const segments = computed(() => {
  if (load.value.status !== 'ready') return []
  const { text, provenance_spans } = load.value.doc
  return segmentText(text, buildSpanTree(provenance_spans, text.length))
})
const stats = computed(() => attributionStats(segments.value))
const total = computed(() => (load.value.status === 'ready' ? load.value.doc.text.length : 0))

// A span that is filtered out can no longer anchor its popover.
const shown = computed(() => (active.value && visible.value[active.value.node.span.source_type] ? active.value : null))

let openTimer: number | undefined
let closeTimer: number | undefined
function clearTimers() {
  window.clearTimeout(openTimer)
  window.clearTimeout(closeTimer)
}
onBeforeUnmount(() => {
  controller.abort()
  clearTimers()
})

function onHover(node: SpanNode, anchor: HTMLElement) {
  clearTimers()
  openTimer = window.setTimeout(() => {
    const cur = active.value
    if (cur?.pinned || cur?.node.id === node.id) return
    active.value = { node, anchor, pinned: false }
  }, HOVER_OPEN_MS)
}

function onLeave() {
  clearTimers()
  closeTimer = window.setTimeout(() => {
    if (!active.value?.pinned) active.value = null
  }, HOVER_CLOSE_MS)
}

function onActivate(node: SpanNode, anchor: HTMLElement) {
  clearTimers()
  active.value = { node, anchor, pinned: true }
}

function onClose() {
  clearTimers()
  active.value = null
}

provide(spanContextKey, {
  visible,
  activeId: computed(() => shown.value?.node.id ?? null),
  onHover,
  onLeave,
  onActivate,
})

function onToggle(type: SourceType, checked: boolean) {
  visible.value = { ...visible.value, [type]: checked }
}

function onOnly(type: SourceType | null) {
  visible.value = { human: !type || type === 'human', ai: !type || type === 'ai', copied: !type || type === 'copied' }
}
</script>

<template>
  <nldd-page background="tinted" sticky-header>
    <nldd-top-navigation-bar slot="header" website-title="TekstOntleder"></nldd-top-navigation-bar>

    <div class="to-layout">
      <div class="to-intro">
        <nldd-title
          size="2"
          heading-level="1"
          overline="Herkomst van tekst"
          text="Documentweergave"
          supporting-text="Zie per fragment of het door een mens is geschreven, door AI is gegenereerd of uit een ander document is gekopieerd. Wijs een gemarkeerd fragment aan of activeer het voor de details."
        ></nldd-title>
      </div>

      <aside class="to-sidebar" aria-label="Weergave-instellingen">
        <FilterPanel :visible="visible" :stats="stats" :total="total" @toggle="onToggle" @only="onOnly" />
        <p class="to-text--sm to-variant-link">
          <a v-if="variant === 'nested'" href="?">Terug naar het standaardvoorbeeld</a>
          <a v-else href="?voorbeeld=genest">Bekijk het voorbeeld met geneste fragmenten</a>
        </p>
      </aside>

      <main class="to-main">
        <nldd-activity-indicator v-if="load.status === 'loading'" accessible-label="Document wordt geladen"></nldd-activity-indicator>
        <nldd-banner
          v-else-if="load.status === 'error'"
          variant="critical"
          text="Het document kon niet worden geladen"
          :supporting-text="load.message"
        ></nldd-banner>
        <nldd-card v-else accessible-label="Document">
          <nldd-container padding="24" gap="16">
            <nldd-title
              size="4"
              heading-level="2"
              :text="load.doc.document_id"
              :supporting-text="`${load.doc.format_version} · hash ${load.doc.document_hash} · ${load.doc.provenance_spans.length} fragmenten`"
            ></nldd-title>
            <nldd-divider></nldd-divider>
            <p class="to-document"><SegmentList :segments="segments" :inside-highlight="false" /></p>
          </nldd-container>
        </nldd-card>
      </main>
    </div>

    <SpanPopover
      :node="shown?.node ?? null"
      :anchor="shown?.anchor ?? null"
      @close="onClose"
      @pointerenter="clearTimers"
      @pointerleave="active?.pinned || onLeave()"
    />
  </nldd-page>
</template>
