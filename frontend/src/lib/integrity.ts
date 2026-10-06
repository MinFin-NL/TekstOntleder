import type { Integrity } from '../types/ljson'

/** Short verdict per integrity status, shared by the status line and the report. */
export const INTEGRITY_LABELS: Record<Integrity['status'], string> = {
  match: 'Hash klopt',
  mismatch: 'Hash klopt niet',
  unknown_format: 'Hash niet te controleren',
}

/** Long enough to compare by eye, short enough not to wrap in a header. */
export const shortHash = (hash: string) => (hash.length > 16 ? `${hash.slice(0, 12)}…` : hash)
