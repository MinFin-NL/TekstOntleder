import type { ProvenanceSpan, SourceType } from '../types/ljson'

/** A provenance span placed in the containment hierarchy. */
export interface SpanNode {
  /** Stable key: index of the span in `provenance_spans` (plus a suffix for split pieces). */
  id: string
  span: ProvenanceSpan
  start: number
  end: number
  children: SpanNode[]
}

/** One renderable piece of the document, in reading order. */
export type Segment =
  | { kind: 'text'; start: number; end: number; text: string }
  | { kind: 'span'; node: SpanNode; children: Segment[] }

interface Pending {
  id: string
  span: ProvenanceSpan
  start: number
  end: number
}

function byPosition(a: Pending, b: Pending): number {
  // Outer spans first: earlier start wins, and on a tie the longer span is the parent.
  return a.start - b.start || b.end - a.end
}

/**
 * Builds a forest of spans by index containment. A span that lies entirely
 * inside another becomes its child. Spans are clamped to the text, and empty
 * spans are dropped.
 *
 * Partial overlaps are out of scope for LJSON 1.0, but rather than producing
 * crossing tags the overlapping span is split at the parent's boundary: the
 * inner piece becomes a child, the remainder is placed after the parent.
 */
export function buildSpanTree(spans: readonly ProvenanceSpan[], textLength: number): SpanNode[] {
  const queue: Pending[] = spans
    .map((span, i) => ({
      id: String(i),
      span,
      start: Math.max(0, Math.min(span.start_idx, textLength)),
      end: Math.max(0, Math.min(span.end_idx, textLength)),
    }))
    .filter((p) => p.end > p.start)
    .sort(byPosition)

  const roots: SpanNode[] = []
  const stack: SpanNode[] = []

  while (queue.length > 0) {
    const item = queue.shift()!

    // Close every open span that ends before this one starts.
    while (stack.length > 0 && stack[stack.length - 1].end <= item.start) stack.pop()

    const parent = stack[stack.length - 1]
    let { end } = item
    if (parent && end > parent.end) {
      // Crossing boundary: keep the part inside the parent, re-queue the rest.
      const rest: Pending = { ...item, id: `${item.id}b`, start: parent.end }
      const at = queue.findIndex((q) => byPosition(rest, q) < 0)
      queue.splice(at === -1 ? queue.length : at, 0, rest)
      end = parent.end
    }

    const node: SpanNode = { id: item.id, span: item.span, start: item.start, end, children: [] }
    if (parent) parent.children.push(node)
    else roots.push(node)
    stack.push(node)
  }

  return roots
}

/**
 * Slices `text[start, end)` into an ordered list of plain-text gaps and span
 * segments, recursing into each span's children. Concatenating every text
 * leaf in order reproduces the original string exactly.
 */
export function segmentText(text: string, nodes: readonly SpanNode[], start = 0, end = text.length): Segment[] {
  const out: Segment[] = []
  let cursor = start
  for (const node of nodes) {
    if (node.start > cursor) out.push({ kind: 'text', start: cursor, end: node.start, text: text.slice(cursor, node.start) })
    out.push({ kind: 'span', node, children: segmentText(text, node.children, node.start, node.end) })
    cursor = node.end
  }
  if (cursor < end) out.push({ kind: 'text', start: cursor, end, text: text.slice(cursor, end) })
  return out
}

/** Characters attributed to each source, counting each character once by its innermost span. */
export function attributionStats(segments: readonly Segment[]): Record<SourceType | 'none', number> {
  const totals: Record<SourceType | 'none', number> = { human: 0, ai: 0, copied: 0, none: 0 }
  const walk = (segs: readonly Segment[], owner: SourceType | 'none') => {
    for (const seg of segs) {
      if (seg.kind === 'text') totals[owner] += seg.end - seg.start
      else walk(seg.children, seg.node.span.source_type)
    }
  }
  walk(segments, 'none')
  return totals
}
