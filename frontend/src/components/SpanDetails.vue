<script setup lang="ts">
import { computed } from 'vue'
import type { SpanNode } from '../lib/segment'
import { SOURCES, formatTimestamp } from '../lib/sources'

const props = defineProps<{ node: SpanNode }>()

type Row = [label: string, value: string | null | undefined]

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
          ['Tijdstip', formatTimestamp(span.metadata.timestamp)],
        ]
      case 'copied':
        return [
          ['Origineel document', span.metadata.original_doc_name],
          ['Gekopieerd door', `${span.metadata.copied_by_name} (${span.metadata.copied_by_email})`],
          ['Tijdstip', formatTimestamp(span.metadata.timestamp)],
        ]
    }
  })()
  return all.filter(([, value]) => value)
})
</script>

<template>
  <nldd-container padding="16" gap="12">
    <div class="to-row">
      <nldd-tag :color="source.tagColor" size="sm" :text="source.label"></nldd-tag>
      <span class="to-text--sm to-text--subtle">Tekens {{ node.start }}–{{ node.end }}</span>
    </div>
    <dl class="to-meta">
      <div v-for="[label, value] in rows" :key="label" class="to-meta__row">
        <dt>{{ label }}</dt>
        <dd>{{ value }}</dd>
      </div>
    </dl>
  </nldd-container>
</template>
