import { describe, expect, it } from 'vitest'
import { describeIssue } from './validationErrors'

describe('describeIssue', () => {
  it('names the fragment and drops the union tag from the location', () => {
    expect(describeIssue({ type: 'missing', loc: ['provenance_spans', 3, 'ai', 'metadata', 'model_identifier'], msg: '' })).toBe(
      'Fragment 4, veld metadata.model_identifier: ontbreekt',
    )
  })

  it('describes top-level fields and whole fragments', () => {
    expect(describeIssue({ type: 'string_type', loc: ['text'], msg: '' })).toBe('Veld text: moet tekst zijn')
    expect(describeIssue({ type: 'span_order', loc: ['provenance_spans', 0, 'human'], msg: '', ctx: { start_idx: 5, end_idx: 3 } })).toBe(
      'Fragment 1: eindpositie (3) moet groter zijn dan beginpositie (5)',
    )
  })

  it('translates document-level span errors', () => {
    const ctx = { index: 1, start_idx: 100, end_idx: 232, other_index: 0, other_start_idx: 0, other_end_idx: 128 }
    expect(describeIssue({ type: 'span_overlap', loc: [], msg: '', ctx })).toBe(
      'Fragment 2 (100–232) overlapt gedeeltelijk met fragment 1 (0–128); een fragment moet een ander helemaal omvatten of er helemaal buiten liggen',
    )
  })

  it('points to the position of invalid JSON', () => {
    expect(describeIssue({ type: 'json_invalid', loc: [], msg: '', ctx: { error: 'key must be a string at line 1 column 2' } })).toBe(
      'Het bestand is geen geldige JSON (regel 1, kolom 2)',
    )
  })

  it('falls back to the original message for unknown types', () => {
    expect(describeIssue({ type: 'too_long', loc: ['document_id'], msg: 'String should have at most 3 characters' })).toBe(
      'Veld document_id: ongeldige waarde (String should have at most 3 characters)',
    )
  })
})
