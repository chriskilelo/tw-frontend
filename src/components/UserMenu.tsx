import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { Link } from 'react-router-dom'
import type { AuthUser, Role } from '../api/auth'
import { useI18n } from '../i18n/context'
import { Avatar, getInitials } from './Avatar'

interface UserMenuProps {
  user: AuthUser
  role: Role | null
  onLogout: () => void
}

/**
 * Sidebar-footer account menu: collapsed trigger (avatar/name/title) expands upward to a card
 * with email, title and department, My Profile, and sign out.
 *
 * FR-AUTH-025: the title is the role's cosmetic display_title when one is configured, falling
 * back to the role name. It is display only — every access decision compares role.name.
 */
export function UserMenu({ user, role, onLogout }: UserMenuProps) {
  const { t } = useI18n()
  const initials = getInitials(user.full_name)
  const title = role?.display_title || role?.name
  const department = user.ministry?.name ?? user.home_ministry?.name

  return (
    <Popover className="relative px-3 pb-3">
      <PopoverButton className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-primary-light px-3 py-2 text-left transition-colors hover:bg-primary-lighter">
        <Avatar initials={initials} src={user.avatar_url} alt={user.full_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-sm font-semibold text-white">{user.full_name}</span>
          {title && <span className="block truncate text-caption text-white/60">{title}</span>}
        </span>
        <ChevronUpDownIcon />
      </PopoverButton>

      <PopoverPanel
        anchor="top start"
        className="z-50 mb-2 w-72 rounded-lg border border-border bg-white shadow-lg"
      >
        {({ close }) => (
          <>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Avatar initials={initials} src={user.avatar_url} alt={user.full_name} inverted />
              <span className="min-w-0">
                <span className="block truncate text-body-sm font-semibold text-text-primary">{user.full_name}</span>
                <span className="block break-all text-caption text-text-muted">{user.email}</span>
                {title && (
                  <span className="block text-caption text-text-secondary" data-testid="user-menu-title">
                    {department ? `${title} · ${department}` : title}
                  </span>
                )}
              </span>
            </div>
            <Link
              to="/profile"
              onClick={() => close()}
              className="flex w-full items-center gap-2 border-b border-border px-4 py-3 text-body-sm text-text-primary hover:bg-section-bg"
            >
              <ProfileIcon />
              {t.profile.title}
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-body-sm text-text-primary hover:bg-section-bg"
            >
              <LogoutIcon />
              {t.nav.logout}
            </button>
          </>
        )}
      </PopoverPanel>
    </Popover>
  )
}

function ChevronUpDownIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4 shrink-0 text-white/60"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m8 9 4-4 4 4M8 15l4 4 4-4" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3m6 14 5-5-5-5m5 5H9"
      />
    </svg>
  )
}
