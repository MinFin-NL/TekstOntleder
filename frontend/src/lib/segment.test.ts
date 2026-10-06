import { describe, expect, it } from 'vitest'
import type { ProvenanceSpan, SourceType } from '../types/ljson'
import { attributionStats, buildSpanTree, codePointToUtf16, segmentText, splitGap, type Segment } from './segment'

const span = (source_type: SourceType, start_idx: number, end_idx: number) =>
  ({ source_type, start_idx, end_idx, metadata: {} }) as unknown as ProvenanceSpan

const flatten = (segs: Segment[]): string =>
  segs.map((s) => (s.kind === 'text' ? s.text : flatten(s.children))).join('')

const shape = (segs: Segment[]): unknown[] =>
  segs.map((s) => (s.kind === 'text' ? s.text : { [s.node.span.source_type]: shape(s.children) }))

describe('segmentText', () => {
  const text = 'abcdefghij'

  it('fills gaps around flat spans and preserves the text', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 5, 8), span('human', 0, 3)], text))
    expect(shape(segs)).toEqual([{ human: ['abc'] }, 'de', { ai: ['fgh'] }, 'ij'])
    expect(flatten(segs)).toBe(text)
  })

  it('nests contained spans', () => {
    const segs = segmentText(text, buildSpanTree([span('human', 3, 5), span('ai', 1, 9), span('copied', 4, 5)], text))
    expect(shape(segs)).toEqual(['a', { ai: ['bc', { human: ['d', { copied: ['e'] }] }, 'fghi'] }, 'j'])
    expect(flatten(segs)).toBe(text)
  })

  it('treats identical ranges as parent and child, longer first', () => {
    const segs = segmentText(text, buildSpanTree([span('human', 2, 4), span('ai', 2, 6)], text))
    expect(shape(segs)).toEqual(['ab', { ai: [{ human: ['cd'] }, 'ef'] }, 'ghij'])
  })

  it('splits a partially overlapping span at the parent boundary', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 0, 5), span('human', 3, 8)], text))
    expect(shape(segs)).toEqual([{ ai: ['abc', { human: ['de'] }] }, { human: ['fgh'] }, 'ij'])
    expect(flatten(segs)).toBe(text)
  })

  it('clamps out-of-range spans and drops empty ones', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 8, 50), span('human', 4, 4)], text))
    expect(shape(segs)).toEqual(['abcdefgh', { ai: ['ij'] }])
  })

  it('counts each character once, by its innermost span', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 0, 6), span('human', 2, 4)], text))
    expect(attributionStats(segs)).toEqual({ ai: 4, human: 2, copied: 0, none: 4 })
  })
})

describe('code-point indexes', () => {
  // '😀' and '𝔸' are one code point but two UTF-16 units each.
  const text = 'a😀bc𝔸d'

  it('maps code points to UTF-16 offsets and clamps', () => {
    const toUtf16 = codePointToUtf16(text)
    expect([0, 1, 2, 3, 4, 5, 6].map(toUtf16)).toEqual([0, 1, 3, 4, 5, 7, 8])
    expect(toUtf16(-1)).toBe(0)
    expect(toUtf16(99)).toBe(text.length)
  })

  it('places spans after astral characters on the right text', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 1, 2), span('human', 4, 6)], text))
    expect(shape(segs)).toEqual(['a', { ai: ['😀'] }, 'bc', { human: ['𝔸d'] }])
    expect(flatten(segs)).toBe(text)
  })

  it('counts code points, not UTF-16 units', () => {
    const segs = segmentText(text, buildSpanTree([span('ai', 1, 2), span('human', 4, 6)], text))
    expect(attributionStats(segs)).toEqual({ ai: 1, human: 2, copied: 0, none: 3 })
  })
})

describe('unknown provenance', () => {
  it('splits a gap into surrounding whitespace and its core', () => {
    expect(splitGap('  twee woorden\n')).toEqual({ lead: '  ', core: 'twee woorden', trail: '\n' })
    expect(splitGap('   ')).toEqual({ lead: '   ', core: '', trail: '' })
    expect(splitGap('')).toEqual({ lead: '', core: '', trail: '' })
  })

  it('does not count whitespace around a gap as unknown, but does count it within the gap', () => {
    const text = 'Een. Twee. Drie zonder bron. Vier.'
    const segs = segmentText(text, buildSpanTree([span('human', 0, 4), span('ai', 5, 10), span('human', 29, 34)], text))
    // ' ' after "Een." and after "Twee." are whitespace-only gaps; ' Drie zonder bron. ' has the core 'Drie zonder bron.' (17).
    expect(attributionStats(segs)).toEqual({ human: 9, ai: 5, copied: 0, none: 17 })
  })
})
