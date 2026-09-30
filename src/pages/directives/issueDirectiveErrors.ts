import { apiErrorMessages } from '../../lib/apiErrors'

export type IssueDirectiveField = 'mission' | 'attache' | 'type' | 'description' | 'date'

export interface IssueDirectiveServerErrors {
  fields: Partial<Record<IssueDirectiveField, string>>
  /** Messages that could not be tied to one field (or a non-validation failure). */
  general: string[]
}

/**
 * The API flattens validation failures to `errors: string[]` (App\Http\Requests\Api\FormRequest),
 * so a message is attributed to a field by the attribute it names. Order matters: date and
 * description are checked first because their messages may also mention the attache or the
 * mission ("Describe what the attache should do"), and the attache before the mission for
 * the same reason ("an attache posted at the selected mission").
 */
const FIELD_MATCHERS: [IssueDirectiveField, RegExp][] = [
  ['date', /completion date|target date|\bdate\b/i],
  ['description', /descri/i],
  ['type', /type category|type_category|\bcategory\b/i],
  ['attache', /attache|target user|target_user/i],
  ['mission', /mission/i],
]

export function mapIssueDirectiveErrors(error: unknown, fallback: string): IssueDirectiveServerErrors {
  const result: IssueDirectiveServerErrors = { fields: {}, general: [] }
  const isValidationFailure =
    typeof error === 'object' && error !== null && (error as { response?: { status?: number } }).response?.status === 422

  for (const message of apiErrorMessages(error, fallback)) {
    const field = isValidationFailure ? FIELD_MATCHERS.find(([, pattern]) => pattern.test(message))?.[0] : undefined
    if (field && !result.fields[field]) {
      result.fields[field] = message
    } else {
      result.general.push(message)
    }
  }
  return result
}
