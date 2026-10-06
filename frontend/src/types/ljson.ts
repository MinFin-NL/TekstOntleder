// Mirrors the Pydantic models in LJSONDocument.py. Timestamps arrive as ISO strings.

export interface HumanMetadata {
  author_name: string
  author_email: string
  department?: string | null
  typing_speed_wpm?: number | null
  timestamp: string
}

export interface AIMetadata {
  model_identifier: string
  trigger_agent: string
  invoked_by?: string | null
  parameters: Record<string, unknown>
  prompt_hash: string
  generation_time_ms?: number | null
  timestamp: string
}

export interface CopiedMetadata {
  original_doc_name: string
  original_doc_hash: string
  original_start_idx: number
  copied_by_name: string
  copied_by_email: string
  timestamp: string
}

interface BaseSpan {
  start_idx: number
  end_idx: number
}

export interface HumanSpan extends BaseSpan {
  source_type: 'human'
  metadata: HumanMetadata
}

export interface AISpan extends BaseSpan {
  source_type: 'ai'
  metadata: AIMetadata
}

export interface CopiedSpan extends BaseSpan {
  source_type: 'copied'
  metadata: CopiedMetadata
}

export type ProvenanceSpan = HumanSpan | AISpan | CopiedSpan
export type SourceType = ProvenanceSpan['source_type']

export const SOURCE_TYPES: readonly SourceType[] = ['human', 'ai', 'copied']

/** Which markings are shown: one per source, plus `none` for text outside every span. */
export type Visibility = Record<SourceType | 'none', boolean>

export interface LJSONDocument {
  document_id: string
  format_version: string
  document_hash: string
  text: string
  provenance_spans: ProvenanceSpan[]
}

/** Mirrors backend/integrity.py: `document_hash` checked as SHA-256 over the UTF-8 text. */
export interface Integrity {
  algorithm: 'sha256'
  computed_hash: string
  status: 'match' | 'mismatch' | 'unknown_format'
}

/** What /api/document returns: the document as stored, plus the server's integrity check. */
export interface DocumentResponse extends LJSONDocument {
  integrity: Integrity
}
