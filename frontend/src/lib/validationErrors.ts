import { SOURCE_TYPES } from '../types/ljson'

/** One entry of Pydantic's `ValidationError.json()`, as the backend returns it. */
export interface ValidationIssue {
  type: string
  loc: (string | number)[]
  msg: string
  ctx?: Record<string, unknown>
}

const TYPE_MESSAGES: Record<string, string> = {
  missing: 'ontbreekt',
  string_type: 'moet tekst zijn',
  int_type: 'moet een geheel getal zijn',
  int_parsing: 'moet een geheel getal zijn',
  int_from_float: 'moet een geheel getal zijn',
  dict_type: 'moet een object zijn',
  model_type: 'moet een object zijn',
  model_attributes_type: 'moet een object zijn',
  list_type: 'moet een lijst zijn',
  datetime_type: 'moet een tijdstip zijn (ISO 8601)',
  datetime_parsing: 'moet een tijdstip zijn (ISO 8601)',
  datetime_from_date_parsing: 'moet een tijdstip zijn (ISO 8601)',
  union_tag_not_found: 'source_type ontbreekt',
}

const fragment = (index: unknown) => `fragment ${Number(index) + 1}`

const field = (path: readonly (string | number)[]) => (path.length ? `veld ${path.join('.')}` : '')

/** "provenance_spans.3.ai.metadata.model_identifier" → "fragment 4, veld metadata.model_identifier". */
function describeLocation(loc: readonly (string | number)[]): string {
  if (loc[0] === 'provenance_spans' && typeof loc[1] === 'number') {
    // After the index Pydantic adds the discriminator tag of the union member; it is not a field.
    const rest = loc.slice(2)
    if (typeof rest[0] === 'string' && (SOURCE_TYPES as readonly string[]).includes(rest[0])) rest.shift()
    return [fragment(loc[1]), field(rest)].filter(Boolean).join(', ')
  }
  return field(loc)
}

function describeProblem({ type, msg, ctx = {} }: ValidationIssue): string {
  switch (type) {
    case 'json_invalid': {
      const at = /line (\d+) column (\d+)/.exec(String(ctx.error ?? ''))
      return `Het bestand is geen geldige JSON${at ? ` (regel ${at[1]}, kolom ${at[2]})` : ''}`
    }
    case 'greater_than_equal':
      return `moet minimaal ${ctx.ge} zijn`
    case 'union_tag_invalid':
      return `onbekende bron "${ctx.tag}", verwacht ${SOURCE_TYPES.join(', ')}`
    case 'span_order':
      return `eindpositie (${ctx.end_idx}) moet groter zijn dan beginpositie (${ctx.start_idx})`
    case 'span_bounds':
      return `${fragment(ctx.index)} eindigt op positie ${ctx.end_idx}, maar de tekst is ${ctx.text_length} tekens lang`
    case 'span_overlap':
      return (
        `${fragment(ctx.index)} (${ctx.start_idx}–${ctx.end_idx}) overlapt gedeeltelijk met ` +
        `${fragment(ctx.other_index)} (${ctx.other_start_idx}–${ctx.other_end_idx}); ` +
        'een fragment moet een ander helemaal omvatten of er helemaal buiten liggen'
      )
    default:
      return TYPE_MESSAGES[type] ?? `ongeldige waarde (${msg})`
  }
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** A Dutch, user-facing line for one validation issue. */
export function describeIssue(issue: ValidationIssue): string {
  const where = describeLocation(issue.loc)
  const what = describeProblem(issue)
  return capitalize(where ? `${where}: ${what}` : what)
}
