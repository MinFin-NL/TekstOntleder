<script setup lang="ts">
import { computed } from 'vue'
import type { Integrity } from '../types/ljson'

const props = defineProps<{ integrity: Integrity; documentHash: string }>()

// Long enough to compare by eye, short enough not to wrap in the header.
const short = (hash: string) => (hash.length > 16 ? `${hash.slice(0, 12)}…` : hash)

const shown = computed(() => {
  switch (props.integrity.status) {
    case 'match':
      return {
        color: 'success',
        icon: 'check-circle-filled',
        label: 'Hash klopt',
        explanation:
          'De tekst is ongewijzigd sinds de hash is berekend. Dit is geen ondertekening: wie de tekst aanpast, kan ook de hash opnieuw berekenen.',
      }
    case 'unknown_format':
      return {
        color: 'warning',
        icon: 'exclamation-triangle-filled',
        label: 'Hash niet te controleren',
        explanation: 'De vastgelegde hash is geen SHA-256-waarde, dus de tekst kan er niet mee worden vergeleken.',
      }
    default:
      return null
  }
})
</script>

<template>
  <nldd-banner
    v-if="integrity.status === 'mismatch'"
    variant="critical"
    size="sm"
    text="De tekst komt niet overeen met de vastgelegde hash"
    :supporting-text="`De tekst is gewijzigd nadat de hash is berekend, dus de herkomstgegevens horen mogelijk bij een andere versie. Vastgelegd: ${short(documentHash)}, berekend: ${short(integrity.computed_hash)} (SHA-256).`"
  ></nldd-banner>
  <div v-else-if="shown" class="to-integrity">
    <nldd-tag size="sm" :color="shown.color" :icon="shown.icon" :text="shown.label"></nldd-tag>
    <span class="to-text--sm to-text--subtle">{{ shown.explanation }} Hash: {{ short(documentHash) }}</span>
  </div>
</template>
