import type { ProvenanceSpan } from '../types/ljson'

/** Someone or something a fragment can be filtered on. */
export interface Actor {
  /** Unique across kinds: `person:<id>` or `model:<id>`. */
  key: string
  label: string
  fragments: number
}

/**
 * The person responsible for a span: its author, who copied it, or who
 * invoked the model. An AI span started by an agent on someone's behalf
 * belongs to that someone; without `invoked_by` the agent itself is the actor.
 */
export function personId(span: ProvenanceSpan): string {
  switch (span.source_type) {
    case 'human':
      return span.metadata.author_email
    case 'copied':
      return span.metadata.copied_by_email
    case 'ai':
      return span.metadata.invoked_by ?? span.metadata.trigger_agent
  }
}

/** Every filter key that applies to a span; it is shown only if none of them is hidden. */
export function actorKeys(span: ProvenanceSpan): string[] {
  const keys = [`person:${personId(span)}`]
  if (span.source_type === 'ai') keys.push(`model:${span.metadata.model_identifier}`)
  return keys
}

function tally(entries: [key: string, label: string][]): Actor[] {
  const byKey = new Map<string, Actor>()
  for (const [key, label] of entries) {
    const actor = byKey.get(key) ?? { key, label, fragments: 0 }
    actor.fragments++
    byKey.set(key, actor)
  }
  return [...byKey.values()].sort((a, b) => b.fragments - a.fragments || a.label.localeCompare(b.label, 'nl'))
}

/** People and models in a document, most fragments first. */
export function listActors(spans: readonly ProvenanceSpan[]): { people: Actor[]; models: Actor[] } {
  // Emails get a name wherever the document gives one; an AI span only carries the email.
  const names = new Map<string, string>()
  for (const span of spans) {
    if (span.source_type === 'human') names.set(span.metadata.author_email, span.metadata.author_name)
    if (span.source_type === 'copied') names.set(span.metadata.copied_by_email, span.metadata.copied_by_name)
  }
  return {
    people: tally(spans.map((span) => [`person:${personId(span)}`, names.get(personId(span)) ?? personId(span)])),
    models: tally(
      spans.flatMap((span) =>
        span.source_type === 'ai' ? [[`model:${span.metadata.model_identifier}`, span.metadata.model_identifier] as [string, string]] : [],
      ),
    ),
  }
}
