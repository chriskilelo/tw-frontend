import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellAlertIcon, BellIcon, CheckCircleIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/20/solid'
import type { GeneralDashboard as GeneralDashboardData } from '../../api/dashboard'
import type { AuthUser, Role } from '../../api/auth'
import { DashboardCard, PanelEmpty } from '../../components/dashboard/DashboardCard'
import { AlertRows, DashboardHero } from '../../components/dashboard/layout'
import { useI18n } from '../../i18n/context'
import { formatRelativeTime, localeFor } from '../../lib/formatters'
import { firstName, greetingPart } from '../../lib/dashboardFormat'

/**
 * Every other ministry role (Designated Deputy, Ministry Publishing Authority, Honorary
 * Consul): no engine screen of their own yet, so the dashboard offers search, anything
 * routed to them, and their unread notifications.
 */
export default function GeneralDashboard({ data, user, role }: { data: GeneralDashboardData; user: AuthUser; role: Role }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const navigate = useNavigate()
  const copy = t.dashboard.general
  const [query, setQuery] = useState('')

  function handleSearch(event: FormEvent) {
    event.preventDefault()
    if (query.trim() !== '') {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  return (
    <>
      <DashboardHero
        title={t.dashboard.hero.greeting[greetingPart()](firstName(user.full_name))}
        subtitle={user.ministry?.name ? `${role.name} · ${user.ministry.name}` : role.name}
        calendar={data.calendar}
        actions={[{ to: '/profile', label: t.dashboard.actions.profile, icon: <UserCircleIcon /> }]}
      />

      <section aria-labelledby="dashboard-search" className="rounded-xl border border-border bg-white p-5 shadow-sm sm:p-6">
        <h2 id="dashboard-search" className="text-h3 text-primary">
          {copy.search.title}
        </h2>
        <p className="mt-1 text-body-sm text-text-secondary">{copy.search.subtitle}</p>
        <form role="search" onSubmit={handleSearch} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="dashboard-search-input" className="sr-only">
            {copy.search.title}
          </label>
          <span className="relative flex-1">
            <MagnifyingGlassIcon aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-text-muted" />
            <input
              id="dashboard-search-input"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search.placeholder}
              className="h-11 w-full rounded-lg border border-border bg-white pl-10 pr-3 text-body text-text-primary placeholder:text-text-muted focus:border-primary"
            />
          </span>
          <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-button text-white hover:bg-primary-light">
            <MagnifyingGlassIcon aria-hidden="true" className="size-4" />
            {copy.search.submit}
          </button>
        </form>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <DashboardCard className="lg:col-span-7" title={copy.alerts.title} icon={<BellAlertIcon />} tone="accent" subtitle={copy.alerts.subtitle(data.assigned_alerts.count)}>
          {data.assigned_alerts.items.length > 0 ? (
            <AlertRows items={data.assigned_alerts.items} />
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.alerts.empty} />
          )}
        </DashboardCard>

        <DashboardCard className="lg:col-span-5" title={copy.notifications.title} icon={<BellIcon />} tone="info" subtitle={copy.notifications.subtitle(data.notifications.unread)}>
          {data.notifications.items.length > 0 ? (
            <ul className="-mx-2 divide-y divide-border">
              {data.notifications.items.map((notification) => {
                const body = (
                  <>
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-body-sm text-text-primary">{notification.message}</span>
                      <span className="block text-caption text-text-secondary">{formatRelativeTime(notification.created_at, locale)}</span>
                    </span>
                  </>
                )
                return (
                  <li key={notification.id}>
                    {notification.link ? (
                      <Link to={notification.link} className="flex gap-3 rounded-lg px-2 py-3 hover:bg-page-bg">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex gap-3 px-2 py-3">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <PanelEmpty icon={<CheckCircleIcon />} title={t.dashboard.common.emptyTitle} body={copy.notifications.empty} />
          )}
        </DashboardCard>
      </div>
    </>
  )
}
