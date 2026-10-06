<script setup lang="ts">
import { ref, watch } from 'vue'
import { SOURCES } from '../lib/sources'
import { SOURCE_TYPES, type SourceType } from '../types/ljson'

const props = defineProps<{
  /** The element holding the rendered document; fragments are its `mark[id]`s. */
  root: HTMLElement | null
  /** The fragment whose details are open, if any: where the reader is. */
  activeId: string | null
}>()

/** The parent focuses and opens the fragment: it first has to let an open popover close. */
const emit = defineEmits<{ jump: [id: string, el: HTMLElement] }>()

const kind = ref<SourceType | 'all'>('all')
const status = ref('')

// Where to continue from: the last fragment that was opened or got focus. The
// buttons take focus themselves, and a click on one first closes the open
// popover, so neither focus nor the open fragment survives until the click.
let last: HTMLElement | null = null
const onFocusIn = (e: FocusEvent) => {
  if (e.target instanceof HTMLElement && e.target.matches('mark[id^="span-"]')) last = e.target
}
watch(
  () => props.root,
  (root, old) => {
    old?.removeEventListener('focusin', onFocusIn)
    root?.addEventListener('focusin', onFocusIn)
    last = null
  },
  { immediate: true },
)
watch(
  () => props.activeId,
  (id) => {
    const el = id ? props.root?.querySelector<HTMLElement>(`#span-${CSS.escape(id)}`) : null
    if (el) last = el
  },
)

/**
 * Marked fragments of the chosen kind, in reading order. Read from the DOM so
 * that whatever the filters hide is skipped without repeating their rules, and
 * a nested fragment follows the one around it.
 */
function fragments(): HTMLElement[] {
  if (!props.root) return []
  const all = [...props.root.querySelectorAll<HTMLElement>('mark[id^="span-"]')]
  return kind.value === 'all' ? all : all.filter((el) => el.classList.contains(`to-span--${kind.value}`))
}

function jump(direction: 1 | -1) {
  const list = fragments()
  const label = kind.value === 'all' ? 'Fragment' : `${SOURCES[kind.value].label}: fragment`
  if (list.length === 0) {
    status.value = 'Er zijn geen gemarkeerde fragmenten van deze soort.'
    return
  }
  // Continue from there, whatever its kind; otherwise from the edge.
  const current = last?.isConnected && props.root?.contains(last) ? last : null
  const bit = direction === 1 ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING
  const candidates = current ? list.filter((el) => el !== current && current.compareDocumentPosition(el) & bit) : list
  const wrapped = candidates.length === 0
  const target = direction === 1 ? (wrapped ? list[0] : candidates[0]) : wrapped ? list[list.length - 1] : candidates[candidates.length - 1]

  // Set now rather than on focus: a quick second press must continue from here.
  last = target
  emit('jump', target.id.replace(/^span-/, ''), target)
  const restart = wrapped && current ? (direction === 1 ? ' Weer vanaf het begin.' : ' Weer vanaf het einde.') : ''
  status.value = `${label} ${list.indexOf(target) + 1} van ${list.length}.${restart}`
}

function onKind(value: string) {
  kind.value = value as SourceType | 'all'
  status.value = ''
}

defineExpose({ jump })
</script>

<template>
  <div class="to-fragment-nav" role="group" aria-label="Door fragmenten springen">
    <nldd-dropdown size="sm" width="12rem" accessible-label="Soort fragment" @change="onKind($event.detail.value)">
      <select>
        <option value="all" selected>Alle fragmenten</option>
        <option v-for="type in SOURCE_TYPES" :key="type" :value="type">{{ SOURCES[type].filterLabel }}</option>
      </select>
    </nldd-dropdown>
    <span class="to-row">
      <nldd-button variant="secondary" size="sm" start-icon="arrow-left" text="Vorige" @click="jump(-1)"></nldd-button>
      <nldd-button variant="secondary" size="sm" end-icon="arrow-right" text="Volgende" @click="jump(1)"></nldd-button>
    </span>
    <span class="to-text--sm to-text--subtle" role="status">{{ status }}</span>
  </div>
  <!-- Shortcuts cannot be typed on touch screens, so the hint is hidden there. -->
  <span class="to-text--xs to-text--subtle to-row to-row--wrap to-shortcut-hint">
    Op een fragment:
    <nldd-keyboard-shortcut keys="J" size="sm"></nldd-keyboard-shortcut>
    volgende,
    <nldd-keyboard-shortcut keys="K" size="sm"></nldd-keyboard-shortcut>
    vorige.
  </span>
</template>
