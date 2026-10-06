import type { InjectionKey, Ref } from 'vue'
import type { Visibility } from '../types/ljson'
import type { SpanNode } from './segment'

/** Shared with every level of the recursive SegmentList, so events need not be re-emitted per level. */
export interface SpanContext {
  visible: Ref<Visibility>
  /** Whether a span is marked: its source and every actor it belongs to are switched on, and it already exists. */
  isShown: (node: SpanNode) => boolean
  /** During a replay: the span was written after the current step. */
  isFuture: (node: SpanNode) => boolean
  /** During a replay: the span the current step added. */
  isCurrent: (node: SpanNode) => boolean
  activeId: Ref<string | null>
  onHover: (node: SpanNode, el: HTMLElement) => void
  onLeave: () => void
  onActivate: (node: SpanNode, el: HTMLElement) => void
}

export const spanContextKey: InjectionKey<SpanContext> = Symbol('spanContext')
