<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { actorOf, type ReportFragment } from '../lib/report'
import { SOURCES, formatTimestamp } from '../lib/sources'

const STEP_MS = 1500

const props = defineProps<{
  /** Fragments oldest first (`buildReport().timeline`); step k shows the first k. */
  steps: ReportFragment[]
  /** 1-based step, or null when not replaying. */
  step: number | null
}>()

const emit = defineEmits<{ 'update:step': [step: number | null] }>()

const playing = ref(false)
let timer: number | undefined

const go = (step: number | null) => emit('update:step', step === null ? null : Math.min(Math.max(step, 1), props.steps.length))

function stopPlaying() {
  playing.value = false
  window.clearInterval(timer)
}

// Auto-play moves on by itself, so it has an obvious pause (WCAG 2.2.2) and stops at the end.
function togglePlay() {
  if (playing.value) return stopPlaying()
  if (props.step === null || props.step >= props.steps.length) go(1)
  playing.value = true
  timer = window.setInterval(() => {
    if (props.step === null || props.step >= props.steps.length) stopPlaying()
    else go(props.step + 1)
  }, STEP_MS)
}

function stop() {
  stopPlaying()
  go(null)
}

watch(
  () => props.step,
  (step) => {
    if (step === null || step >= props.steps.length) stopPlaying()
  },
)
onBeforeUnmount(stopPlaying)

const current = computed(() => (props.step === null ? null : props.steps[props.step - 1]))

const status = (i: number) => (props.step === null || i + 1 > props.step ? 'future' : i + 1 === props.step ? 'current' : 'past')
const position = (i: number) => (props.steps.length === 1 ? 'only' : i === 0 ? 'first' : i === props.steps.length - 1 ? 'last' : 'between')
</script>

<template>
  <nldd-card v-if="steps.length" accessible-label="Tijdlijn">
    <nldd-container padding="16" gap="12">
      <nldd-title size="5" heading-level="2" text="Tijdlijn"></nldd-title>
      <template v-if="step === null">
        <span class="to-text--sm">Speel af in welke volgorde de fragmenten zijn ontstaan.</span>
        <div class="to-row">
          <nldd-button variant="secondary" size="sm" start-icon="clock" text="Tijdlijn bekijken" @click="go(1)"></nldd-button>
        </div>
      </template>
      <template v-else>
        <div class="to-row to-row--wrap">
          <nldd-button variant="secondary" size="sm" start-icon="media-backward-frame" text="Vorige stap" @click="go(step - 1)"></nldd-button>
          <nldd-button variant="secondary" size="sm" end-icon="media-forward-frame" text="Volgende stap" @click="go(step + 1)"></nldd-button>
          <nldd-button
            variant="secondary"
            size="sm"
            :start-icon="playing ? 'pause' : 'play'"
            :text="playing ? 'Pauzeren' : 'Afspelen'"
            @click="togglePlay"
          ></nldd-button>
          <nldd-button variant="neutral-transparent" size="sm" start-icon="stop" text="Stoppen" @click="stop"></nldd-button>
        </div>
        <span class="to-text--sm" role="status">
          <template v-if="current">
            Stap {{ step }} van {{ steps.length }}: {{ SOURCES[current.span.source_type].label }} door
            {{ actorOf(current.span) }}, {{ formatTimestamp(current.span.metadata.timestamp) }}.
          </template>
        </span>
        <nldd-list variant="box-base" accessible-label="Stappen van de tijdlijn" class="to-replay-steps">
          <nldd-list-item v-for="(f, i) in steps" :key="f.number" size="sm" button :current="i + 1 === step" @click="go(i + 1)">
            <nldd-timeline-track-cell :status="status(i)" :position="position(i)"></nldd-timeline-track-cell>
            <nldd-text-cell size="sm">
              {{ formatTimestamp(f.span.metadata.timestamp) }}
              <span slot="supporting-text">Fragment {{ f.number }} · {{ SOURCES[f.span.source_type].label }} · {{ actorOf(f.span) }}</span>
            </nldd-text-cell>
          </nldd-list-item>
        </nldd-list>
        <span class="to-text--xs to-text--subtle">
          De tekst blijft de eindversie: wat er stond voordat een fragment werd aangepast, staat niet in het document.
          Tekst die op dit moment nog niet geschreven was, is grijs en schuin.
        </span>
      </template>
    </nldd-container>
  </nldd-card>
</template>
