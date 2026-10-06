<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue'
import FilterPanel from './components/FilterPanel.vue'
import IntegrityStatus from './components/IntegrityStatus.vue'
import ReportView from './components/ReportView.vue'
import SegmentList from './components/SegmentList.vue'
import SpanPopover from './components/SpanPopover.vue'
import UploadPanel from './components/UploadPanel.vue'
import { attributionStats, buildSpanTree, segmentText, type SpanNode } from './lib/segment'
import { spanContextKey } from './lib/spanContext'
import type { DocumentResponse, SourceType, Visibility } from './types/ljson'

const HOVER_OPEN_MS = 150
const HOVER_CLOSE_MS = 250

const variant = new URLSearchParams(window.location.search).get('voorbeeld') === 'genest' ? 'nested' : 'example'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  /** `fileName` is set when the document was uploaded rather than one of the examples. */
  | { status: 'ready'; doc: DocumentResponse; fileName?: string }

interface Active {
  node: SpanNode
  anchor: HTMLElement
  /** Opened by click or keyboard: stays open until dismissed, ignores hover. */
  pinned: boolean
}

const load = shallowRef<LoadState>({ status: 'loading' })
const visible = ref<Visibility>({ human: true, ai: true, copied: true, none: true })
const active = shallowRef<Active | null>(null)

const controller = new AbortController()
onMounted(async () => {
  try {
    const res = await fetch(`/api/document?variant=${variant}`, { signal: controller.signal })
    if (!res.ok) throw new Error(`De server gaf status ${res.status}.`)
    load.value = { status: 'ready', doc: (await res.json()) as DocumentResponse }
  } catch (err) {
    if (controller.signal.aborted) return
    load.value = { status: 'error', message: err instanceof Error ? err.message : String(err) }
  }
})

const segments = computed(() => {
  if (load.value.status !== 'ready') return []
  const { text, provenance_spans } = load.value.doc
  return segmentText(text, buildSpanTree(provenance_spans, text))
})
const stats = computed(() => attributionStats(segments.value))
// Whitespace around unknown gaps is in no category, so the shares add up to 100%.
const total = computed(() => Object.values(stats.value).reduce((a, b) => a + b, 0))

// A span that is filtered out can no longer anchor its popover.
const shown = computed(() => (active.value && visible.value[active.value.node.span.source_type] ? active.value : null))

let openTimer: number | undefined
let closeTimer: number | undefined
function clearTimers() {
  window.clearTimeout(openTimer)
  window.clearTimeout(closeTimer)
}
// A hover popover lives in the top layer, outside nldd-page's scroller: once it
// sits under the pointer it swallows the wheel and the page stops scrolling.
// Scrolling therefore dismisses it (a pinned one stays) and cancels a pending open.
function onWheel() {
  clearTimers()
  if (active.value && !active.value.pinned) active.value = null
}
onMounted(() => window.addEventListener('wheel', onWheel, { passive: true }))
onBeforeUnmount(() => {
  controller.abort()
  clearTimers()
  window.removeEventListener('wheel', onWheel)
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

function onToggle(type: keyof Visibility, checked: boolean) {
  visible.value = { ...visible.value, [type]: checked }
}

function onUploaded(doc: DocumentResponse, fileName: string) {
  // An upload replaces the example, also when that is still loading.
  controller.abort()
  onClose()
  load.value = { status: 'ready', doc, fileName }
}

// The report replaces the document view in place, so an uploaded document survives the switch.
const view = ref<'document' | 'report'>('document')
const reportView = ref<InstanceType<typeof ReportView> | null>(null)
const reportButton = ref<HTMLElement | null>(null)

async function openReport() {
  onClose()
  view.value = 'report'
  await nextTick()
  reportView.value?.focus()
}

function printReport() {
  window.print()
}

async function closeReport() {
  view.value = 'document'
  await nextTick()
  reportButton.value?.focus()
}

function onOnly(type: SourceType | null) {
  visible.value = { human: !type || type === 'human', ai: !type || type === 'ai', copied: !type || type === 'copied', none: !type }
}
</script>

<template>
  <nldd-page background="tinted" sticky-header>
    <nldd-top-navigation-bar slot="header" website-title="TekstOntleder"></nldd-top-navigation-bar>

    <div :class="['to-layout', { 'to-layout--report': view === 'report' }]">
      <div class="to-intro">
        <nldd-title
          size="2"
          heading-level="1"
          overline="Herkomst van tekst"
          text="Documentweergave"
          supporting-text="Zie per fragment of het door een mens is geschreven, door AI is gegenereerd of uit een ander document is gekopieerd. Wijs een gemarkeerd fragment aan of activeer het voor de details."
        ></nldd-title>
      </div>

      <aside v-show="view === 'document'" class="to-sidebar" aria-label="Weergave-instellingen">
        <FilterPanel :visible="visible" :stats="stats" :total="total" @toggle="onToggle" @only="onOnly" />
        <UploadPanel @loaded="onUploaded" />
        <p class="to-text--sm to-variant-link">
          <a v-if="load.status === 'ready' && load.fileName" href="?">Terug naar het voorbeeld</a>
          <a v-else-if="variant === 'nested'" href="?">Terug naar het standaardvoorbeeld</a>
          <a v-else href="?voorbeeld=genest">Bekijk het voorbeeld met geneste fragmenten</a>
        </p>
      </aside>

      <main class="to-main">
        <nldd-activity-indicator v-if="load.status === 'loading'" text="Document wordt geladen"></nldd-activity-indicator>
        <nldd-banner
          v-else-if="load.status === 'error'"
          variant="critical"
          text="Het document kon niet worden geladen"
          :supporting-text="load.message"
        ></nldd-banner>
        <template v-else>
          <div class="to-toolbar">
            <nldd-button
              v-if="view === 'document'"
              ref="reportButton"
              variant="secondary"
              size="sm"
              start-icon="file-text"
              text="Herkomstrapport"
              @click="openReport"
            ></nldd-button>
            <template v-else>
              <nldd-button variant="secondary" size="sm" start-icon="arrow-left" text="Terug naar het document" @click="closeReport"></nldd-button>
              <nldd-button variant="primary" size="sm" start-icon="printer" text="Afdrukken of opslaan als pdf" @click="printReport"></nldd-button>
            </template>
          </div>
          <nldd-card v-if="view === 'document'" accessible-label="Document">
            <nldd-container padding="24" gap="16">
              <nldd-title
                size="4"
                heading-level="2"
                :text="load.doc.document_id"
                :supporting-text="`${load.fileName ? `${load.fileName} · ` : ''}${load.doc.format_version} · ${load.doc.provenance_spans.length} fragmenten`"
              ></nldd-title>
              <IntegrityStatus :integrity="load.doc.integrity" :document-hash="load.doc.document_hash" />
              <nldd-divider></nldd-divider>
              <p class="to-document"><SegmentList :segments="segments" :inside-highlight="false" /></p>
            </nldd-container>
          </nldd-card>
          <ReportView v-else ref="reportView" :doc="load.doc" :file-name="load.fileName" :stats="stats" :total="total" />
        </template>
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
