import type { BlockRole, StructureBlock } from '../types/ljson'
import { codePointToUtf16, segmentText, splitGap, type Segment, type SpanNode } from './segment'

/** One block of a structured document, ready to render with its own element. */
export interface LayoutBlock {
  key: string
  /** Null for text between blocks that no block claims: shown as a plain paragraph. */
  role: BlockRole | null
  /** UTF-16 offsets into the text. */
  start: number
  end: number
  segments: Segment[]
}

/**
 * The span trees cut to `[start, end)`. A span that lies wholly inside keeps
 * its node; one that crosses the edge is clipped. The first piece of a span
 * keeps its id (so `#span-<id>` still finds it); later pieces get a suffix, as
 * buildSpanTree does for split overlaps, so element ids stay unique.
 */
function clip(nodes: readonly SpanNode[], start: number, end: number, used: Set<string>): SpanNode[] {
  return nodes.flatMap((node) => {
    if (node.end <= start || node.start >= end) return []
    const id = used.has(node.id) ? `${node.id}~${Math.max(node.start, start)}` : node.id
    used.add(node.id)
    if (node.start >= start && node.end <= end && id === node.id) return [node]
    const s = Math.max(node.start, start)
    const e = Math.min(node.end, end)
    return [{ ...node, id, start: s, end: e, children: clip(node.children, s, e, used) }]
  })
}

/**
 * Lays the text out by its structure blocks, in reading order. The whitespace
 * between blocks is the layout's job now and is dropped; text between blocks
 * that isn't whitespace is kept as a block without a role, so nothing is lost.
 * Indexes are code points, as everywhere in LJSON; overlapping blocks (which
 * the backend rejects) are skipped rather than drawn twice.
 */
export function layoutBlocks(text: string, roots: readonly SpanNode[], structure: readonly StructureBlock[]): LayoutBlock[] {
  const toUtf16 = codePointToUtf16(text)
  const blocks = structure
    .map((b) => ({ role: b.role, start: toUtf16(b.start_idx), end: toUtf16(b.end_idx) }))
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start)

  const out: LayoutBlock[] = []
  const used = new Set<string>()
  const push = (role: BlockRole | null, start: number, end: number) => {
    out.push({ key: `${start}`, role, start, end, segments: segmentText(text, clip(roots, start, end, used), start, end) })
  }
  const gap = (start: number, end: number) => {
    const { lead, core } = splitGap(text.slice(start, end))
    if (core) push(null, start + lead.length, start + lead.length + core.length)
  }

  let cursor = 0
  for (const block of blocks) {
    if (block.start < cursor) continue
    gap(cursor, block.start)
    push(block.role, block.start, block.end)
    cursor = block.end
  }
  gap(cursor, text.length)
  return out
}
