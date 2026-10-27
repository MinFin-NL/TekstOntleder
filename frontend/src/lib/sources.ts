import type { SourceType } from '../types/ljson'

export interface SourceInfo {
  /** Short noun, used in legends and screen-reader announcements. */
  label: string
  /** Filter checkbox label. */
  filterLabel: string
  /** NLDD Rijkshuisstijl category colour for nldd-tag. */
  tagColor: string
}

export const SOURCES: Record<SourceType, SourceInfo> = {
  // Same hues as the highlights (--to-*-fill in index.css).
  human: { label: 'Mens', filterLabel: 'Door een mens geschreven', tagColor: 'geel' },
  ai: { label: 'AI', filterLabel: 'Door AI gegenereerd', tagColor: 'violet' },
  copied: { label: 'Gekopieerd', filterLabel: 'Gekopieerd uit een ander document', tagColor: 'lintblauw' },
}

/** Text outside every span. Not a source, so it has no entry in SOURCES. */
export const UNKNOWN_LABEL = 'Herkomst onbekend'

const dateFormat = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Amsterdam' })

export function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : dateFormat.format(d)
}
