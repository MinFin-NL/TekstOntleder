<script setup lang="ts">
import { computed } from 'vue'
import type { SpanNode } from '../lib/segment'
import { SOURCES, formatTimestamp } from '../lib/sources'

const props = defineProps<{ node: SpanNode }>()

/** `code` sets the value in monospace: hashes are compared character by character. */
type Row = [label: string, value: string | null | undefined, code?: boolean]

const source = computed(() => SOURCES[props.node.span.source_type])

const rows = computed<Row[]>(() => {
  const { span } = props.node
  const all: Row[] = (() => {
    switch (span.source_type) {
      case 'human':
        return [
          ['Auteur', span.metadata.author_name],
          ['E-mail', span.metadata.author_email],
          ['Afdeling', span.metadata.department],
          ['Typesnelheid', span.metadata.typing_speed_wpm != null ? `${span.metadata.typing_speed_wpm} woorden per minuut` : null],
          ['Tijdstip', formatTimestamp(span.metadata.timestamp)],
        ]
      case 'ai':
        return [
          ['Model', span.metadata.model_identifier],
          ['Aangeroepen door', span.metadata.trigger_agent],
          ['Namens', span.metadata.invoked_by],
          [
            'Parameters',
            Object.entries(span.metadata.parameters)
              .map(([k, v]) => `${k} = ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
              .join(', ') || 'geen',
          ],
          ['Generatietijd', span.metadata.generation_time_ms != null ? `${span.metadata.generation_time_ms} ms` : null],
          ['Prompt-hash', span.metadata.prompt_hash, true],
          ['Tijdstip', formatTimestamp(span.metadata.timestamp)],
        ]
      case 'copied':
        return [
          ['Origineel document', span.metadata.original_doc_name],
          // The copy has the span's length, so its place in the original follows from the start.
          [
            'Plek in origineel',
            `Tekens ${span.metadata.original_start_idx}–${span.metadata.original_start_idx + span.end_idx - span.start_idx}`,
          ],
          ['Hash origineel', span.metadata.original_doc_hash, true],
          ['Gekopieerd door', `${span.metadata.copied_by_name} (${span.metadata.copied_by_email})`],
          ['Tijdstip', formatTimestamp(span.metadata.timestamp)],
        ]
    }
  })()
  return all.filter(([, value]) => value != null && value !== '')
})
</script>

<template>
  <nldd-container padding="16" gap="12">
    <div class="to-row">
      <nldd-tag :color="source.tagColor" size="sm" :text="source.label"></nldd-tag>
      <span class="to-text--sm to-text--subtle">Tekens {{ node.span.start_idx }}–{{ node.span.end_idx }}</span>
    </div>
    <dl class="to-meta">
      <div v-for="[label, value, code] in rows" :key="label" class="to-meta__row">
        <dt>{{ label }}</dt>
        <dd><code v-if="code" class="to-code">{{ value }}</code><template v-else>{{ value }}</template></dd>
      </div>
    </dl>
  </nldd-container>
</template>
