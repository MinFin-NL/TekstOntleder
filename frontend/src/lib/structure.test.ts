import { describe, expect, it } from 'vitest'
import type { ProvenanceSpan, SourceType, StructureBlock } from '../types/ljson'
import { buildSpanTree, type Segment } from './segment'
import { layoutBlocks } from './structure'

const span = (source_type: SourceType, start_idx: number, end_idx: number) =>
  ({ source_type, start_idx, end_idx, metadata: {} }) as unknown as ProvenanceSpan
const block = (role: StructureBlock['role'], start_idx: number, end_idx: number): StructureBlock => ({ role, start_idx, end_idx })

const flatten = (segs: Segment[]): string => segs.map((s) => (s.kind === 'text' ? s.text : flatten(s.children))).join('')
const ids = (segs: Segment[]): string[] => segs.flatMap((s) => (s.kind === 'text' ? [] : [s.node.id, ...ids(s.children)]))

describe('layoutBlocks', () => {
  const text = 'Titel\n\nVraag?\nAntwoord.\n'

  it('cuts the text into its blocks and drops the newlines between them', () => {
    const blocks = layoutBlocks(text, [], [block('title', 0, 5), block('question', 7, 13), block('answer', 14, 23)])
    expect(blocks.map((b) => [b.role, flatten(b.segments)])).toEqual([
      ['title', 'Titel'],
      ['question', 'Vraag?'],
      ['answer', 'Antwoord.'],
    ])
  })

  it('keeps text no block claims as a block without a role', () => {
    const blocks = layoutBlocks(text, [], [block('title', 0, 5), block('answer', 14, 23)])
    expect(blocks.map((b) => [b.role, flatten(b.segments)])).toEqual([
      ['title', 'Titel'],
      [null, 'Vraag?'],
      ['answer', 'Antwoord.'],
    ])
  })

  it('keeps spans inside a block whole, nesting included', () => {
    const tree = buildSpanTree([span('ai', 14, 23), span('copied', 14, 22)], text)
    const answer = layoutBlocks(text, tree, [block('answer', 14, 23)]).find((b) => b.role === 'answer')!
    expect(ids(answer.segments)).toEqual(['0', '1'])
  })

  it('splits a span that crosses blocks, with unique ids for the later pieces', () => {
    const tree = buildSpanTree([span('human', 0, 23)], text)
    const blocks = layoutBlocks(text, tree, [block('title', 0, 5), block('question', 7, 13), block('answer', 14, 23)])
    expect(blocks.map((b) => ids(b.segments))).toEqual([['0'], ['0~7'], ['0~14']])
    expect(blocks.map((b) => flatten(b.segments))).toEqual(['Titel', 'Vraag?', 'Antwoord.'])
  })

  it('counts block indexes in code points', () => {
    const emoji = '🚀 Titel\nAntwoord'
    const [title, answer] = layoutBlocks(emoji, [], [block('title', 0, 7), block('answer', 8, 16)])
    expect(flatten(title.segments)).toBe('🚀 Titel')
    expect(flatten(answer.segments)).toBe('Antwoord')
  })
})
