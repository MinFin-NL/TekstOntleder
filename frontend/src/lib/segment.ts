import type { ProvenanceSpan, SourceType } from '../types/ljson'

/** A provenance span placed in the containment hierarchy. */
export interface SpanNode {
  /** Stable key: index of the span in `provenance_spans` (plus a suffix for split pieces). */
  id: string
  span: ProvenanceSpan
  /** UTF-16 offsets into the text, ready for `String.prototype.slice`. */
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
 * LJSON indexes count Unicode code points (Python `len`), JS strings count
 * UTF-16 code units. Returns a converter from the former to the latter,
 * clamped to the text. Without astral characters the two are identical.
 */
export function codePointToUtf16(text: string): (index: number) => number {
  const offsets = [0]
  for (const ch of text) offsets.push(offsets[offsets.length - 1] + ch.length)
  const last = offsets.length - 1
  if (last === text.length) return (i) => Math.max(0, Math.min(i, last))
  return (i) => offsets[Math.max(0, Math.min(i, last))]
}

/** Length of a string in code points, the unit LJSON indexes and users count in. */
export const codePointLength = (text: string): number => Array.from(text).length

/**
 * Builds a forest of spans by index containment. A span that lies entirely
 * inside another becomes its child. Span indexes are code points; they are
 * converted to UTF-16 offsets and clamped to the text, and empty spans are dropped.
 *
 * Partial overlaps are out of scope for LJSON 1.0, but rather than producing
 * crossing tags the overlapping span is split at the parent's boundary: the
 * inner piece becomes a child, the remainder is placed after the parent.
 */
export function buildSpanTree(spans: readonly ProvenanceSpan[], text: string): SpanNode[] {
  const toUtf16 = codePointToUtf16(text)
  const queue: Pending[] = spans
    .map((span, i) => ({ id: String(i), span, start: toUtf16(span.start_idx), end: toUtf16(span.end_idx) }))
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

/**
 * Splits a gap outside every span into its leading whitespace, the rest, and
 * its trailing whitespace. Only `core` is text of unknown provenance: the space
 * between two attributed sentences is not a source of its own.
 */
export function splitGap(text: string): { lead: string; core: string; trail: string } {
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
  return { lead, core, trail }
}

/**
 * Code points attributed to each source, counting each character once by its
 * innermost span. `none` counts text outside every span, without the whitespace
 * around it (see `splitGap`), so the totals add up to what is marked.
 */
export function attributionStats(segments: readonly Segment[]): Record<SourceType | 'none', number> {
  const totals: Record<SourceType | 'none', number> = { human: 0, ai: 0, copied: 0, none: 0 }
  const walk = (segs: readonly Segment[], owner: SourceType | 'none') => {
    for (const seg of segs) {
      if (seg.kind === 'text') totals[owner] += codePointLength(owner === 'none' ? splitGap(seg.text).core : seg.text)
      else walk(seg.children, seg.node.span.source_type)
    }
  }
  walk(segments, 'none')
  return totals
}
