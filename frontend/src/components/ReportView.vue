<script setup lang="ts">
import { computed, ref } from 'vue'
import { INTEGRITY_LABELS } from '../lib/integrity'
import { actorOf, buildReport } from '../lib/report'
import { SOURCES, UNKNOWN_LABEL, formatTimestamp } from '../lib/sources'
import { SOURCE_TYPES, type DocumentResponse, type SourceType } from '../types/ljson'

const props = defineProps<{
  doc: DocumentResponse
  fileName?: string
  stats: Record<SourceType | 'none', number>
  total: number
}>()

const report = computed(() => buildReport(props.doc))
const createdAt = formatTimestamp(new Date().toISOString())
const pct = (n: number) => (props.total ? Math.round((n / props.total) * 100) : 0)

const shares = computed(() => [
  ...SOURCE_TYPES.map((type) => ({ key: type, type, label: SOURCES[type].label, chars: props.stats[type] })),
  { key: 'none', type: null, label: UNKNOWN_LABEL, chars: props.stats.none },
])

const details = computed<[string, string][]>(() => [
  ['Document', props.doc.document_id],
  ...(props.fileName ? [['Bestand', props.fileName] as [string, string]] : []),
  ['Formaat', props.doc.format_version],
  ['Fragmenten', String(props.doc.provenance_spans.length)],
  ['Integriteit', `${INTEGRITY_LABELS[props.doc.integrity.status]} (SHA-256)`],
  ['Opgesteld op', createdAt],
])

const root = ref<HTMLElement | null>(null)
defineExpose({ focus: () => root.value?.focus() })
</script>

<template>
  <section ref="root" class="to-report" tabindex="-1" aria-label="Herkomstrapport">
    <nldd-card accessible-label="Herkomstrapport">
      <nldd-container padding="24" gap="24">
        <nldd-title
          size="3"
          heading-level="2"
          overline="Herkomstrapport"
          :text="doc.document_id"
          supporting-text="Overzicht van wie welke tekst heeft geschreven, gegenereerd of gekopieerd, en wanneer."
        ></nldd-title>

        <dl class="to-meta">
          <div v-for="[label, value] in details" :key="label" class="to-meta__row">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </div>
          <div class="to-meta__row">
            <dt>Hash</dt>
            <dd><code class="to-code">{{ doc.document_hash }}</code></dd>
          </div>
        </dl>

        <div class="to-report__section">
          <nldd-title size="5" heading-level="3" text="Herkomst van de tekst"></nldd-title>
          <nldd-table accessible-label="Herkomst van de tekst" columns="minmax(6rem,1fr) auto auto">
            <nldd-table-row slot="header">
              <nldd-text-cell size="sm" text="Bron"></nldd-text-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right" text="Tekens"></nldd-text-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right" text="Aandeel"></nldd-text-cell>
            </nldd-table-row>
            <nldd-table-row v-for="row in shares" :key="row.key">
              <nldd-cell>
                <nldd-tag v-if="row.type" size="sm" :color="SOURCES[row.type].tagColor" :text="row.label"></nldd-tag>
                <nldd-tag v-else size="sm" color="neutral" :text="row.label"></nldd-tag>
              </nldd-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right">{{ row.chars }}</nldd-text-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right">{{ pct(row.chars) }}%</nldd-text-cell>
            </nldd-table-row>
          </nldd-table>
          <span class="to-text--xs to-text--subtle">
            Tekst binnen een genest fragment telt mee voor het binnenste fragment, zodat elk teken één keer wordt geteld.
            Witruimte tussen fragmenten telt niet mee.
          </span>
        </div>

        <div class="to-report__section">
          <nldd-title size="5" heading-level="3" text="Gebruikte AI-modellen"></nldd-title>
          <nldd-table
            v-if="report.models.length"
            accessible-label="Gebruikte AI-modellen"
            columns="minmax(12rem,1fr) 7rem minmax(12rem,1.5fr)"
          >
            <nldd-table-row slot="header">
              <nldd-text-cell size="sm" text="Model"></nldd-text-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right" text="Fragmenten"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Aangeroepen door"></nldd-text-cell>
            </nldd-table-row>
            <nldd-table-row v-for="usage in report.models" :key="usage.model">
              <nldd-text-cell size="sm">{{ usage.model }}</nldd-text-cell>
              <nldd-text-cell size="sm" horizontal-alignment="right">{{ usage.fragments }}</nldd-text-cell>
              <nldd-text-cell size="sm">{{ usage.invokers.join(', ') }}</nldd-text-cell>
            </nldd-table-row>
          </nldd-table>
          <span v-else class="to-text--sm">Dit document bevat geen door AI gegenereerde tekst.</span>
        </div>

        <div class="to-report__section">
          <nldd-title size="5" heading-level="3" text="Gekopieerde tekst"></nldd-title>
          <nldd-table
            v-if="report.copied.length"
            accessible-label="Gekopieerde tekst"
            columns="6rem minmax(12rem,1.5fr) minmax(10rem,1fr) minmax(10rem,1fr)"
          >
            <nldd-table-row slot="header">
              <nldd-text-cell size="sm" text="Fragment"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Origineel document"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Gekopieerd door"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Tijdstip"></nldd-text-cell>
            </nldd-table-row>
            <template v-for="f in report.copied" :key="f.number">
              <nldd-table-row v-if="f.span.source_type === 'copied'">
                <nldd-text-cell size="sm">{{ f.number }}</nldd-text-cell>
                <nldd-text-cell size="sm">{{ f.span.metadata.original_doc_name }}</nldd-text-cell>
                <nldd-text-cell size="sm">{{ f.span.metadata.copied_by_name }}</nldd-text-cell>
                <nldd-text-cell size="sm">{{ formatTimestamp(f.span.metadata.timestamp) }}</nldd-text-cell>
              </nldd-table-row>
            </template>
          </nldd-table>
          <span v-else class="to-text--sm">Dit document bevat geen gekopieerde tekst.</span>
        </div>

        <div class="to-report__section">
          <nldd-title size="5" heading-level="3" text="Alle fragmenten op volgorde van tijd"></nldd-title>
          <nldd-table
            accessible-label="Alle fragmenten op volgorde van tijd"
            columns="minmax(10rem,auto) minmax(8rem,auto) minmax(10rem,1fr) minmax(14rem,2fr)"
          >
            <nldd-table-row slot="header">
              <nldd-text-cell size="sm" text="Tijdstip"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Fragment"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Door"></nldd-text-cell>
              <nldd-text-cell size="sm" text="Tekst"></nldd-text-cell>
            </nldd-table-row>
            <nldd-table-row v-for="f in report.timeline" :key="f.number">
              <nldd-text-cell size="sm" vertical-alignment="top">{{ formatTimestamp(f.span.metadata.timestamp) }}</nldd-text-cell>
              <nldd-cell vertical-alignment="top">
                <span class="to-row">
                  <span class="to-text--sm">{{ f.number }}</span>
                  <nldd-tag size="sm" :color="SOURCES[f.span.source_type].tagColor" :text="SOURCES[f.span.source_type].label"></nldd-tag>
                </span>
              </nldd-cell>
              <nldd-text-cell size="sm" vertical-alignment="top">{{ actorOf(f.span) }}</nldd-text-cell>
              <nldd-text-cell size="sm" vertical-alignment="top">{{ f.excerpt }}</nldd-text-cell>
            </nldd-table-row>
          </nldd-table>
        </div>

        <span class="to-text--xs to-text--subtle">
          Dit rapport is samengesteld uit de herkomstgegevens in het document zelf. De hash-controle laat zien of de
          tekst is gewijzigd sinds de hash is berekend; het is geen ondertekening.
        </span>
      </nldd-container>
    </nldd-card>
  </section>
</template>
