import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAvatar, updatePreferences, uploadAvatar } from '../api/auth'
import { useAuth, AUTH_QUERY_KEY } from '../hooks/useAuth'
import { useI18n } from '../i18n/context'
import type { LanguagePreference } from '../i18n'
import { Avatar, getInitials } from '../components/Avatar'

const LANGUAGES: LanguagePreference[] = ['en', 'sw']
const NOTIFICATION_TRIGGERS = ['alert_routed', 'directive_issued', 'report_deadline_reminder'] as const

/**
 * My Profile: read-only account details (name/email/role/mission/ministry are managed by a
 * System Administrator, not self-editable — CLAUDE.md Section 5/9) plus the two preferences
 * PATCH /me/preferences already supports (language, per-trigger email opt-out, FR-I18N-002/
 * FR-NOTIF-006) that previously had no dedicated UI beyond the header's language toggle.
 */
export default function ProfilePage() {
  const { user, role } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const notifMutation = useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      updatePreferences({ email_notification_preferences: preferences }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  })

  const avatarUploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  })

  const avatarRemoveMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
  })

  if (!user) {
    return null
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      avatarUploadMutation.mutate(file)
    }
  }

  const initials = getInitials(user.full_name)
  const notificationPreferences = user.email_notification_preferences ?? {}

  function toggleTrigger(trigger: string) {
    notifMutation.mutate({
      ...notificationPreferences,
      [trigger]: !(notificationPreferences[trigger] ?? true),
    })
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-h1 text-primary">{t.profile.title}</h1>

      {/* Header card */}
      <div className="mt-4 rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar initials={initials} src={user.avatar_url} alt={user.full_name} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-h3 text-text-primary">{user.full_name}</p>
            {role && <p className="text-body-sm text-text-secondary">{role.name}</p>}
            {(user.mission || user.ministry) && (
              <p className="truncate text-body-sm text-text-muted">
                {[user.mission?.name, user.ministry?.name].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            onChange={handleFileSelected}
            className="hidden"
            aria-label={t.profile.avatar.changeButton}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploadMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded border border-primary bg-primary px-3 py-2 text-body-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon />
            {avatarUploadMutation.isPending ? t.profile.avatar.uploading : t.profile.avatar.changeButton}
          </button>
          {user.avatar_url && (
            <button
              type="button"
              onClick={() => avatarRemoveMutation.mutate()}
              disabled={avatarRemoveMutation.isPending}
              className="rounded border border-border bg-white px-3 py-2 text-body-sm font-semibold text-text-primary transition-colors hover:bg-section-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {avatarRemoveMutation.isPending ? t.profile.avatar.removing : t.profile.avatar.removeButton}
            </button>
          )}
        </div>
        <p className="mt-2 text-caption text-text-muted">{t.profile.avatar.formatHint}</p>
        {avatarUploadMutation.isError && (
          <p role="alert" className="mt-1 text-caption text-danger-soft-text">
            {t.profile.avatar.uploadFailed}
          </p>
        )}
      </div>

      {/* Account Information: read-only, self-service edit is out of scope (System Admin only) */}
      <section className="mt-4 rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="text-h3 text-primary">{t.profile.accountInfo.title}</h2>
        <p className="mt-1 text-caption text-text-muted">{t.profile.accountInfo.readOnlyHint}</p>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t.profile.accountInfo.fullNameLabel} value={user.full_name} />
          <Field label={t.profile.accountInfo.emailLabel} value={user.email} />
          <Field label={t.profile.accountInfo.roleLabel} value={role?.name ?? t.profile.accountInfo.notApplicable} />
          <Field label={t.profile.accountInfo.statusLabel} value={t.profile.status[user.status]} />
          <Field
            label={t.profile.accountInfo.missionLabel}
            value={user.mission?.name ?? t.profile.accountInfo.notApplicable}
          />
          <Field
            label={t.profile.accountInfo.ministryLabel}
            value={user.ministry?.name ?? t.profile.accountInfo.notApplicable}
          />
        </dl>
      </section>

      {/* Preferences: the only genuinely self-editable section, PATCH /me/preferences */}
      <section className="mt-4 rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-h3 text-primary">{t.profile.preferences.title}</h2>
          {notifMutation.isPending && (
            <span className="text-caption text-text-muted">{t.profile.preferences.saving}</span>
          )}
          {notifMutation.isError && (
            <span role="alert" className="text-caption text-danger-soft-text">
              {t.profile.preferences.saveFailed}
            </span>
          )}
        </div>

        <div className="mt-4">
          <span className="text-body-sm font-semibold text-text-secondary">{t.profile.preferences.languageLabel}</span>
          <div className="mt-2 flex gap-2" role="group" aria-label={t.profile.preferences.languageLabel}>
            {LANGUAGES.map((lang) => (
              <button
                key={lang}
                type="button"
                aria-pressed={language === lang}
                onClick={() => setLanguage(lang)}
                className={`rounded border px-3 py-2 text-body-sm font-semibold transition-colors ${
                  language === lang
                    ? 'border-accent bg-accent text-accent-text'
                    : 'border-border bg-white text-text-primary hover:bg-section-bg'
                }`}
              >
                {t.language[lang]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-body-sm font-semibold text-text-secondary">{t.profile.preferences.notificationsTitle}</p>
          <p className="mt-1 text-caption text-text-muted">{t.profile.preferences.notificationsHint}</p>
          <div className="mt-3 flex flex-col gap-2">
            {NOTIFICATION_TRIGGERS.map((trigger) => (
              <label key={trigger} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={notificationPreferences[trigger] ?? true}
                  onChange={() => toggleTrigger(trigger)}
                  className="h-4 w-4 rounded border-border accent-accent focus:ring-accent"
                />
                <span className="text-body-sm text-text-primary">{t.profile.preferences.triggers[trigger]}</span>
              </label>
            ))}
          </div>
        </div>
      </section>

      {/* Security: no in-app change-password endpoint exists yet, only the emailed-token flow */}
      <section className="mt-4 rounded-lg border border-border bg-white p-6 shadow-sm">
        <h2 className="text-h3 text-primary">{t.profile.security.title}</h2>
        <p className="mt-2 text-body-sm text-text-secondary">{t.profile.security.changePasswordHint}</p>
        <Link
          to="/forgot-password"
          className="mt-2 inline-block text-body-sm font-semibold text-accent-soft-text hover:underline"
        >
          {t.profile.security.changePasswordLink}
        </Link>
      </section>
    </div>
  )
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-body-sm font-semibold text-text-secondary">{label}</dt>
      <dd className="mt-1 text-body text-text-primary">{value}</dd>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}
