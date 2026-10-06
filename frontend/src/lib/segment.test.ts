import { describe, expect, it } from 'vitest'
import type { ProvenanceSpan, SourceType } from '../types/ljson'
import { attributionStats, buildSpanTree, segmentText, type Segment } from './segment'

const span = (source_type: SourceType, start_idx: number, end_idx: number) =>
  ({ source_type, start_idx, end_idx, metadata: {} }) as unknown as ProvenanceSpan

const flatten = (segs: Segment[]): string =>
  segs.map((s) => (s.kind === 'text' ? s.text : flatten(s.children))).join('')

const shape = (segs: Segment[]): unknown[] =>
  segs.map((s) => (s.kind === 'text' ? s.text : { [s.node.span.source_type]: shape(s.children) }))

describe('segmentText', () => {
  const text = 'abcdefghij'

  it('fills gaps around flat spans and preserves the text', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 5, 8), span('human', 0, 3)], text.length))
    expect(shape(segs)).toEqual([{ human: ['abc'] }, 'de', { ai: ['fgh'] }, 'ij'])
    expect(flatten(segs)).toBe(text)
  })

  it('nests contained spans', () => {
    const segs = segmentText(text, buildSpanTree([span('human', 3, 5), span('ai', 1, 9), span('copied', 4, 5)], text.length))
    expect(shape(segs)).toEqual(['a', { ai: ['bc', { human: ['d', { copied: ['e'] }] }, 'fghi'] }, 'j'])
    expect(flatten(segs)).toBe(text)
  })

  it('treats identical ranges as parent and child, longer first', () => {
    const segs = segmentText(text, buildSpanTree([span('human', 2, 4), span('ai', 2, 6)], text.length))
    expect(shape(segs)).toEqual(['ab', { ai: [{ human: ['cd'] }, 'ef'] }, 'ghij'])
  })

  it('splits a partially overlapping span at the parent boundary', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 0, 5), span('human', 3, 8)], text.length))
    expect(shape(segs)).toEqual([{ ai: ['abc', { human: ['de'] }] }, { human: ['fgh'] }, 'ij'])
    expect(flatten(segs)).toBe(text)
  })

  it('clamps out-of-range spans and drops empty ones', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 8, 50), span('human', 4, 4)], text.length))
    expect(shape(segs)).toEqual(['abcdefgh', { ai: ['ij'] }])
  })

  it('counts each character once, by its innermost span', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 0, 6), span('human', 2, 4)], text.length))
    expect(attributionStats(segs)).toEqual({ ai: 4, human: 2, copied: 0, none: 4 })
  })
})
