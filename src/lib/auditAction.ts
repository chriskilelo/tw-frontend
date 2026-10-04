import type { BadgeVariant } from '../components/Badge'

/**
 * Colours an audit action by what kind of event it was, from the action
 * string alone (e.g. "alert.created", "user.login.failed"). Order matters:
 * more specific substrings (e.g. "deactivated") must be checked before the
 * broader ones they contain ("activated" is a substring of "deactivated").
 */
export function auditActionVariant(action: string): BadgeVariant {
  if (/\.(failed|tampered)$/.test(action) || action.includes('rejected')) {
    return 'danger'
  }

  if (action.includes('deactivated') || action.includes('deleted') || action.includes('cancelled') || action.includes('locked') || action.includes('purged')) {
    return 'atrisk'
  }

  if (
    action.endsWith('.created') ||
    action.includes('succeeded') ||
    action.includes('approved') ||
    action.includes('activated') ||
    action.includes('submitted') ||
    action.includes('restored')
  ) {
    return 'success'
  }

  if (
    action.endsWith('.updated') ||
    action.includes('promoted') ||
    action.includes('accessed') ||
    action.includes('generated') ||
    action.includes('delegated') ||
    action.includes('issued')
  ) {
    return 'info'
  }

  return 'neutral'
}

/** "alert.created" -> "Alert · Created"; "user.login.succeeded" -> "User · Login Succeeded". */
export function formatAuditAction(action: string): string {
  const [subject, ...rest] = action.split('.')
  const subjectLabel = subject
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  const verbLabel = rest
    .join(' ')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  return verbLabel ? `${subjectLabel} · ${verbLabel}` : subjectLabel
}

/** "App\Models\MasterDataEntry" -> "Master Data Entry"; already-plain types (e.g. "ministry") pass through capitalised. */
export function formatRecordType(affectedEntityType: string): string {
  const shortName = affectedEntityType.split('\\').pop() ?? affectedEntityType

  return shortName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase())
}
