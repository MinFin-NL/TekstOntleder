<script setup lang="ts">
import { SOURCES } from '../lib/sources'
import { SOURCE_TYPES, type SourceType } from '../types/ljson'

const props = defineProps<{
  visible: Record<SourceType, boolean>
  stats: Record<SourceType | 'none', number>
  total: number
}>()

const emit = defineEmits<{
  toggle: [type: SourceType, checked: boolean]
  only: [type: SourceType | null]
}>()

const pct = (n: number) => (props.total ? Math.round((n / props.total) * 100) : 0)
</script>

<template>
  <nldd-card accessible-label="Markeringen">
    <nldd-container padding="16" gap="16">
      <!-- NLDD has no checkbox group: a real fieldset + legend carries the semantics. -->
      <fieldset class="to-fieldset">
        <legend>
          <nldd-title size="5" text="Markeringen tonen"></nldd-title>
        </legend>
        <div class="to-stack">
          <div v-for="type in SOURCE_TYPES" :key="type" class="to-row">
            <span :class="['to-swatch', `to-swatch--${type}`]" aria-hidden="true"></span>
            <nldd-checkbox-field
              name="bron"
              :value="type"
              :label="SOURCES[type].filterLabel"
              :checked="visible[type]"
              @change="emit('toggle', type, $event.detail.checked)"
            ></nldd-checkbox-field>
          </div>
        </div>
      </fieldset>
      <div class="to-row to-row--wrap">
        <nldd-button variant="secondary" size="sm" text="Alleen menselijke tekst" @click="emit('only', 'human')"></nldd-button>
        <nldd-button variant="secondary" size="sm" text="Alles markeren" @click="emit('only', null)"></nldd-button>
      </div>
      <nldd-divider></nldd-divider>
      <div class="to-stack">
        <nldd-title size="5" heading-level="2" text="Herkomst van de tekst"></nldd-title>
        <ul class="to-stats">
          <li v-for="type in SOURCE_TYPES" :key="type">
            <span :class="['to-sample', 'to-span', `to-span--${type}`, 'to-span--fill']">{{ SOURCES[type].label }}</span>
            <span class="to-text--sm">
              {{ pct(stats[type]) }}% <span class="to-text--subtle">({{ stats[type] }} tekens)</span>
            </span>
          </li>
          <li>
            <span class="to-sample">Onbekend</span>
            <span class="to-text--sm">
              {{ pct(stats.none) }}% <span class="to-text--subtle">({{ stats.none }} tekens)</span>
            </span>
          </li>
        </ul>
        <span class="to-text--xs to-text--subtle">
          Een fragment binnen een ander fragment krijgt een onderstreping in plaats van een achtergrondkleur. Elke bron
          heeft een eigen lijnstijl: doorgetrokken (mens), gestippeld (AI) of gestreept (gekopieerd).
        </span>
      </div>
    </nldd-container>
  </nldd-card>
</template>
