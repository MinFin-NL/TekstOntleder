import type { LJSONDocument, ProvenanceSpan } from '../types/ljson'

const EXCERPT_LENGTH = 80

/** One provenance span as the report lists it. `number` is 1-based, as in validation messages. */
export interface ReportFragment {
  number: number
  span: ProvenanceSpan
  excerpt: string
}

export interface ModelUsage {
  model: string
  fragments: number
  /** Everyone and everything that invoked the model, in order of first appearance. */
  invokers: string[]
}

export interface Report {
  /** All fragments, oldest first; equal timestamps keep document order. */
  timeline: ReportFragment[]
  models: ModelUsage[]
  copied: ReportFragment[]
}

/** First `max` code points, whitespace collapsed, with an ellipsis when cut. */
export function excerpt(text: string, max = EXCERPT_LENGTH): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim())
  return chars.length > max ? `${chars.slice(0, max - 1).join('').trimEnd()}…` : chars.join('')
}

/** Who wrote, generated or copied a span, in one line. */
export function actorOf(span: ProvenanceSpan): string {
  switch (span.source_type) {
    case 'human':
      return span.metadata.author_name
    case 'ai':
      return `${span.metadata.model_identifier} (via ${span.metadata.invoked_by ?? span.metadata.trigger_agent})`
    case 'copied':
      return span.metadata.copied_by_name
  }
}

export function buildReport(doc: LJSONDocument): Report {
  // LJSON indexes count code points.
  const chars = Array.from(doc.text)
  const fragments: ReportFragment[] = doc.provenance_spans.map((span, i) => ({
    number: i + 1,
    span,
    excerpt: excerpt(chars.slice(span.start_idx, span.end_idx).join('')),
  }))

  const time = (f: ReportFragment) => Date.parse(f.span.metadata.timestamp)
  const timeline = [...fragments].sort((a, b) => time(a) - time(b) || a.number - b.number)

  const models = new Map<string, ModelUsage>()
  for (const { span } of fragments) {
    if (span.source_type !== 'ai') continue
    const { model_identifier: model, trigger_agent, invoked_by } = span.metadata
    const usage = models.get(model) ?? { model, fragments: 0, invokers: [] }
    usage.fragments++
    for (const who of [trigger_agent, invoked_by]) if (who && !usage.invokers.includes(who)) usage.invokers.push(who)
    models.set(model, usage)
  }

  return {
    timeline,
    models: [...models.values()],
    copied: fragments.filter((f) => f.span.source_type === 'copied'),
  }
}
