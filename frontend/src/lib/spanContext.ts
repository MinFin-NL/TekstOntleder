import type { InjectionKey, Ref } from 'vue'
import type { SourceType } from '../types/ljson'
import type { SpanNode } from './segment'

/** Shared with every level of the recursive SegmentList, so events need not be re-emitted per level. */
export interface SpanContext {
  visible: Ref<Record<SourceType, boolean>>
  activeId: Ref<string | null>
  onHover: (node: SpanNode, el: HTMLElement) => void
  onLeave: () => void
  onActivate: (node: SpanNode, el: HTMLElement) => void
}

export const spanContextKey: InjectionKey<SpanContext> = Symbol('spanContext')
