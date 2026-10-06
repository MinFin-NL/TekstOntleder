import { describe, expect, it } from 'vitest'
import type { LJSONDocument, ProvenanceSpan } from '../types/ljson'
import { actorOf, buildReport, excerpt } from './report'

const human = (start_idx: number, end_idx: number, timestamp: string, author_name = 'Ans'): ProvenanceSpan => ({
  source_type: 'human',
  start_idx,
  end_idx,
  metadata: { author_name, author_email: 'ans@example.nl', timestamp },
})

const ai = (start_idx: number, end_idx: number, timestamp: string, model: string, trigger_agent: string, invoked_by?: string): ProvenanceSpan => ({
  source_type: 'ai',
  start_idx,
  end_idx,
  metadata: { model_identifier: model, trigger_agent, invoked_by, parameters: {}, prompt_hash: 'p', timestamp },
})

const copied = (start_idx: number, end_idx: number, timestamp: string): ProvenanceSpan => ({
  source_type: 'copied',
  start_idx,
  end_idx,
  metadata: {
    original_doc_name: 'bron.pdf',
    original_doc_hash: 'h',
    original_start_idx: 10,
    copied_by_name: 'Bo',
    copied_by_email: 'bo@example.nl',
    timestamp,
  },
})

const doc = (text: string, spans: ProvenanceSpan[]): LJSONDocument => ({
  document_id: 'd',
  format_version: 'LJSON_1.0',
  document_hash: 'x',
  text,
  provenance_spans: spans,
})

describe('excerpt', () => {
  it('collapses whitespace and cuts on code points', () => {
    expect(excerpt('  a\n\n b  ')).toBe('a b')
    expect(excerpt('😀😀😀😀', 3)).toBe('😀😀…')
  })
})

describe('actorOf', () => {
  it('names the model and who invoked it, preferring the person behind an agent', () => {
    expect(actorOf(ai(0, 1, '2026-01-01T00:00:00Z', 'm', 'editor_autocomplete', 'a@example.nl'))).toBe('m (via a@example.nl)')
    expect(actorOf(ai(0, 1, '2026-01-01T00:00:00Z', 'm', 'b@example.nl'))).toBe('m (via b@example.nl)')
    expect(actorOf(human(0, 1, '2026-01-01T00:00:00Z'))).toBe('Ans')
  })
})

describe('buildReport', () => {
  const text = 'Eén 😀 twee drie vier.'
  const report = buildReport(
    doc(text, [
      human(0, 5, '2026-01-01T10:00:00Z'),
      ai(6, 10, '2026-01-01T09:00:00Z', 'model-a', 'x@example.nl'),
      ai(11, 15, '2026-01-01T09:00:00Z', 'model-a', 'editor_autocomplete', 'y@example.nl'),
      ai(16, 21, '2026-01-01T11:00:00+02:00', 'model-b', 'x@example.nl'),
      copied(0, 3, '2026-01-01T12:00:00Z'),
    ]),
  )

  it('orders fragments by time, keeping document order on ties and honouring offsets', () => {
    expect(report.timeline.map((f) => f.number)).toEqual([2, 3, 4, 1, 5])
  })

  it('takes excerpts by code point', () => {
    expect(report.timeline.find((f) => f.number === 1)?.excerpt).toBe('Eén 😀')
  })

  it('groups AI fragments per model with every invoker once', () => {
    expect(report.models).toEqual([
      { model: 'model-a', fragments: 2, invokers: ['x@example.nl', 'editor_autocomplete', 'y@example.nl'] },
      { model: 'model-b', fragments: 1, invokers: ['x@example.nl'] },
    ])
  })

  it('lists copied fragments in document order', () => {
    expect(report.copied.map((f) => f.number)).toEqual([5])
  })
})
