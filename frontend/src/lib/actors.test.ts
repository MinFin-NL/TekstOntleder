import { describe, expect, it } from 'vitest'
import type { ProvenanceSpan } from '../types/ljson'
import { actorKeys, listActors, personId } from './actors'

const T = '2026-01-01T00:00:00Z'
const human = (author_name: string, author_email: string): ProvenanceSpan => ({
  source_type: 'human',
  start_idx: 0,
  end_idx: 1,
  metadata: { author_name, author_email, timestamp: T },
})
const ai = (model: string, trigger_agent: string, invoked_by?: string): ProvenanceSpan => ({
  source_type: 'ai',
  start_idx: 0,
  end_idx: 1,
  metadata: { model_identifier: model, trigger_agent, invoked_by, parameters: {}, prompt_hash: 'p', timestamp: T },
})
const copied = (copied_by_name: string, copied_by_email: string): ProvenanceSpan => ({
  source_type: 'copied',
  start_idx: 0,
  end_idx: 1,
  metadata: {
    original_doc_name: 'bron.pdf',
    original_doc_hash: 'h',
    original_start_idx: 0,
    copied_by_name,
    copied_by_email,
    timestamp: T,
  },
})

describe('personId', () => {
  it('attributes an agent-started AI span to the person it acted for', () => {
    expect(personId(ai('m', 'editor_autocomplete', 'lieke@x.nl'))).toBe('lieke@x.nl')
    expect(personId(ai('m', 'sander@x.nl'))).toBe('sander@x.nl')
    expect(personId(ai('m', 'batch_job'))).toBe('batch_job')
  })
})

describe('actorKeys', () => {
  it('filters AI spans on both person and model', () => {
    expect(actorKeys(ai('m', 'a@x.nl'))).toEqual(['person:a@x.nl', 'model:m'])
    expect(actorKeys(human('Ans', 'ans@x.nl'))).toEqual(['person:ans@x.nl'])
  })
})

describe('listActors', () => {
  const { people, models } = listActors([
    human('Sander', 'sander@x.nl'),
    ai('model-a', 'sander@x.nl'),
    copied('Lieke', 'lieke@x.nl'),
    ai('model-b', 'editor_autocomplete', 'lieke@x.nl'),
    human('Lieke', 'lieke@x.nl'),
    ai('model-b', 'batch_job'),
  ])

  it('names people from any span that gives a name, counts their fragments, most first', () => {
    expect(people).toEqual([
      { key: 'person:lieke@x.nl', label: 'Lieke', fragments: 3 },
      { key: 'person:sander@x.nl', label: 'Sander', fragments: 2 },
      { key: 'person:batch_job', label: 'batch_job', fragments: 1 },
    ])
  })

  it('lists models with their fragment count', () => {
    expect(models).toEqual([
      { key: 'model:model-b', label: 'model-b', fragments: 2 },
      { key: 'model:model-a', label: 'model-a', fragments: 1 },
    ])
  })
})
