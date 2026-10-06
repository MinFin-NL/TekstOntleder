<script setup lang="ts">
import { computed } from 'vue'
import type { Actor } from '../lib/actors'

const props = defineProps<{
  people: Actor[]
  models: Actor[]
  hidden: Record<string, boolean>
}>()

const emit = defineEmits<{
  toggle: [key: string, checked: boolean]
  reset: []
}>()

const groups = computed(() =>
  [
    { title: 'Personen', actors: props.people },
    { title: 'AI-modellen', actors: props.models },
  ].filter((group) => group.actors.length > 0),
)

const anyHidden = computed(() => Object.values(props.hidden).some(Boolean))

const label = (actor: Actor) => `${actor.label} (${actor.fragments} ${actor.fragments === 1 ? 'fragment' : 'fragmenten'})`
</script>

<template>
  <nldd-card v-if="groups.length" accessible-label="Filteren op wie">
    <nldd-container padding="16" gap="16">
      <nldd-title size="5" heading-level="2" text="Filteren op wie"></nldd-title>
      <!-- NLDD has no checkbox group: a real fieldset + legend carries the semantics. -->
      <fieldset v-for="group in groups" :key="group.title" class="to-fieldset">
        <legend>
          <span class="to-text--sm to-legend">{{ group.title }}</span>
        </legend>
        <div class="to-stack">
          <nldd-checkbox-field
            v-for="actor in group.actors"
            :key="actor.key"
            name="actor"
            :value="actor.key"
            :label="label(actor)"
            :checked="!hidden[actor.key]"
            @change="emit('toggle', actor.key, $event.detail.checked)"
          ></nldd-checkbox-field>
        </div>
      </fieldset>
      <div class="to-row">
        <nldd-button variant="secondary" size="sm" text="Iedereen tonen" :disabled="!anyHidden" @click="emit('reset')"></nldd-button>
      </div>
      <span class="to-text--xs to-text--subtle">
        Een AI-fragment hoort bij de persoon die het model aanriep. Zet je iemand uit, dan verdwijnt alleen de markering;
        de tekst blijft staan.
      </span>
    </nldd-container>
  </nldd-card>
</template>
