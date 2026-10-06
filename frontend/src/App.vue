<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, shallowRef, watch } from 'vue'
import ActorFilter from './components/ActorFilter.vue'
import FilterPanel from './components/FilterPanel.vue'
import FragmentNav from './components/FragmentNav.vue'
import IntegrityStatus from './components/IntegrityStatus.vue'
import ReplayPanel from './components/ReplayPanel.vue'
import ReportView from './components/ReportView.vue'
import SegmentList from './components/SegmentList.vue'
import SpanPopover from './components/SpanPopover.vue'
import UploadPanel from './components/UploadPanel.vue'
import { actorKeys, listActors } from './lib/actors'
import { buildReport } from './lib/report'
import { attributionStats, buildSpanTree, segmentText, type SpanNode } from './lib/segment'
import { spanContextKey } from './lib/spanContext'
import type { DocumentResponse, ProvenanceSpan, SourceType, Visibility } from './types/ljson'

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
/** Actor keys (see lib/actors) switched off. Kept as "hidden" so a new document starts with everyone shown. */
const hiddenActors = ref<Record<string, boolean>>({})
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

/** Every rendered span by id, to resolve a `mark#span-<id>` back to its node. */
const nodesById = computed(() => {
  const map = new Map<string, SpanNode>()
  const walk = (nodes: readonly SpanNode[]) => nodes.forEach((n) => (map.set(n.id, n), walk(n.children)))
  for (const seg of segments.value) if (seg.kind === 'span') walk([seg.node])
  return map
})

const documentEl = ref<HTMLElement | null>(null)
const fragmentNav = ref<InstanceType<typeof FragmentNav> | null>(null)

/**
 * nldd-popover takes focus when it opens and hands it back to where it came
 * from when it closes, also when a click elsewhere closes it. Jumping while it
 * is open would see that hand-back land after the new focus, so close it first
 * and wait for its close event (or a frame or two, if it was already closing).
 */
let popoverClosed: (() => void) | null = null
function closePopover(): Promise<void> {
  // Our state, not :popover-open: after a click elsewhere the popover is already
  // hidden, but its close event (and the focus hand-back) has yet to arrive.
  if (!shown.value) {
    onClose()
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => done(), 200)
    const done = () => {
      window.clearTimeout(timeout)
      popoverClosed = null
      resolve()
    }
    popoverClosed = done
    onClose()
  })
}

async function onJump(id: string, el: HTMLElement) {
  const node = nodesById.value.get(id)
  if (!node) return
  await closePopover()
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'center' })
  onActivate(node, el)
}

function onPopoverClose() {
  onClose()
  popoverClosed?.()
}

// J/K only while a fragment or its open details have focus: a single-key
// shortcut must not fire while typing elsewhere (WCAG 2.1.4).
function onFragmentKey(e: KeyboardEvent) {
  if (e.altKey || e.ctrlKey || e.metaKey || !(e.target instanceof HTMLElement)) return
  if (!e.target.matches('mark[id^="span-"]') && !e.target.closest('nldd-popover')) return
  const direction = e.key === 'j' || e.key === 'J' ? 1 : e.key === 'k' || e.key === 'K' ? -1 : 0
  if (!direction) return
  e.preventDefault()
  fragmentNav.value?.jump(direction)
}
// Whitespace around unknown gaps is in no category, so the shares add up to 100%.
const total = computed(() => Object.values(stats.value).reduce((a, b) => a + b, 0))

const actors = computed(() => (load.value.status === 'ready' ? listActors(load.value.doc.provenance_spans) : { people: [], models: [] }))

function isSpanShown(span: ProvenanceSpan): boolean {
  return visible.value[span.source_type] && !actorKeys(span).some((key) => hiddenActors.value[key])
}

// ── Replay ── step k shows the k oldest spans (see buildReport().timeline); null when off.
const replayStep = ref<number | null>(null)
const timeline = computed(() => (load.value.status === 'ready' ? buildReport(load.value.doc).timeline : []))
const existing = computed(() =>
  replayStep.value === null ? null : new Set(timeline.value.slice(0, replayStep.value).map((f) => f.number - 1)),
)
const currentIndex = computed(() => (replayStep.value === null ? null : timeline.value[replayStep.value - 1].number - 1))
// Node ids are the span's index in provenance_spans, with a suffix for the pieces of a split span.
const spanIndex = (node: SpanNode) => Number.parseInt(node.id, 10)
const isFuture = (node: SpanNode) => existing.value !== null && !existing.value.has(spanIndex(node))
const isNodeShown = (node: SpanNode) => isSpanShown(node.span) && !isFuture(node)

watch(currentIndex, async (index) => {
  if (index === null) return
  await nextTick()
  documentEl.value?.querySelector(`#span-${index}`)?.scrollIntoView({ block: 'nearest' })
})

// A span that is filtered out, or not yet written in a replay, can no longer anchor its popover.
const shown = computed(() => (active.value && isNodeShown(active.value.node) ? active.value : null))

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
  isShown: isNodeShown,
  isFuture,
  isCurrent: (node) => currentIndex.value === spanIndex(node),
  activeId: computed(() => shown.value?.node.id ?? null),
  onHover,
  onLeave,
  onActivate,
})

function onToggle(type: keyof Visibility, checked: boolean) {
  visible.value = { ...visible.value, [type]: checked }
}

function onActorToggle(key: string, checked: boolean) {
  hiddenActors.value = { ...hiddenActors.value, [key]: !checked }
}

function onUploaded(doc: DocumentResponse, fileName: string) {
  // An upload replaces the example, also when that is still loading.
  controller.abort()
  onClose()
  hiddenActors.value = {}
  replayStep.value = null
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
        <ReplayPanel v-model:step="replayStep" :steps="timeline" />
        <ActorFilter
          :people="actors.people"
          :models="actors.models"
          :hidden="hiddenActors"
          @toggle="onActorToggle"
          @reset="hiddenActors = {}"
        />
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
              <FragmentNav ref="fragmentNav" :root="documentEl" :active-id="shown?.node.id ?? null" @jump="onJump" />
              <p ref="documentEl" class="to-document" @keydown="onFragmentKey"><SegmentList :segments="segments" :inside-highlight="false" /></p>
            </nldd-container>
          </nldd-card>
          <ReportView v-else ref="reportView" :doc="load.doc" :file-name="load.fileName" :stats="stats" :total="total" />
        </template>
      </main>
    </div>

    <SpanPopover
      :node="shown?.node ?? null"
      :anchor="shown?.anchor ?? null"
      @close="onPopoverClose"
      @keydown="onFragmentKey"
      @pointerenter="clearTimers"
      @pointerleave="active?.pinned || onLeave()"
    />
  </nldd-page>
</template>
