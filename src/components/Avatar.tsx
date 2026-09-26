/** Derives up-to-2-letter initials from a full name, e.g. "Sang Bett" -> "SB". */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ''
  return (first + last).toUpperCase()
}

interface AvatarProps {
  initials: string
  /** FR-AUTH-019: the signed photo URL from AuthUser.avatar_url. Falls back to initials when absent (BR-024, AC2). */
  src?: string | null
  alt?: string
  inverted?: boolean
  size?: 'sm' | 'lg'
}

/** Shared avatar (photo or initials fallback) used by UserMenu (sidebar) and ProfilePage (My Profile header). */
export function Avatar({ initials, src, alt = '', inverted = false, size = 'sm' }: AvatarProps) {
  const sizeClasses = size === 'lg' ? 'h-14 w-14 text-h3' : 'h-8 w-8 text-caption'

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={`shrink-0 rounded-md object-cover ${sizeClasses}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-md font-semibold ${sizeClasses} ${
        inverted ? 'bg-accent-soft text-accent-soft-text' : 'bg-accent text-accent-text'
      }`}
    >
      {initials}
    </span>
  )
}
