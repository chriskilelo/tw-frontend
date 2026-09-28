import { useEffect, type ComponentType, type SVGProps } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowUturnLeftIcon, ChevronRightIcon, HomeIcon } from '@heroicons/react/20/solid'
import { useBreadcrumbContext, type BreadcrumbLabel } from '../hooks/useBreadcrumbs'
import { useI18n } from '../i18n/context'
import { NAV_ICONS } from '../layouts/navigation'
import { resolveTrail, type TrailCrumb } from '../lib/breadcrumbTrail'

type DisplayItem =
  | { kind: 'home'; isOrigin: boolean }
  | { kind: 'group'; label: string }
  | { kind: 'link'; crumb: TrailCrumb; label: BreadcrumbLabel; isOrigin: boolean }
  | { kind: 'current'; crumb: TrailCrumb; label: BreadcrumbLabel }

const DASHBOARD_PATH = '/dashboard'

/**
 * The app-shell breadcrumb bar: Home, then any section group, then each page down to the
 * current one (a highlighted pill). The page the user arrived from is marked in the trail
 * when it is part of it, or offered as a "From …" chip when it is not; both link back to
 * that page's exact URL, list filters included. Also keeps the browser tab title in step.
 */
export function Breadcrumbs({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const copy = t.breadcrumbs
  const { pathname } = useLocation()
  const context = useBreadcrumbContext()
  const labels = context?.labels ?? {}
  const previous = context?.previous ?? null

  const labelOf = (crumb: TrailCrumb): BreadcrumbLabel => {
    const { definition } = crumb
    if (definition.param) {
      return { text: decodeURIComponent(crumb.params[definition.param] ?? ''), isCode: false }
    }
    if (definition.isDynamic && labels[crumb.path]) {
      return labels[crumb.path]
    }
    if (definition.nav) {
      return { text: t.nav[definition.nav], isCode: false }
    }
    return { text: definition.page ? copy.pages[definition.page] : '', isCode: false }
  }

  const trail = resolveTrail(pathname)
  const current = trail.at(-1)
  const currentLabel = current ? labelOf(current) : null
  const isDashboard = trail.length === 1 && current?.definition.nav === 'dashboard'

  const previousUrl = previous ? `${previous.pathname}${previous.search}` : null
  const originIndex = previous ? trail.findIndex((crumb, index) => index < trail.length - 1 && crumb.path === previous.pathname) : -1
  const isHomeOrigin = previous?.pathname === DASHBOARD_PATH && !isDashboard && originIndex === -1
  const previousCrumb = previous ? resolveTrail(previous.pathname).at(-1) : undefined
  const previousLabel = previousCrumb ? labelOf(previousCrumb) : null
  const showFromChip = Boolean(previousUrl && previousLabel?.text && originIndex === -1 && !isHomeOrigin && previous?.pathname !== pathname)

  const titleText = currentLabel?.text
  useEffect(() => {
    document.title = titleText ? `${titleText} · ${t.nav.brandTitle}` : t.nav.brandTitle
  }, [titleText, t.nav.brandTitle])

  if (!current || !currentLabel) {
    return null
  }

  const items: DisplayItem[] = []
  if (!isDashboard) {
    items.push({ kind: 'home', isOrigin: isHomeOrigin })
  }
  if (trail[0].definition.group) {
    items.push({ kind: 'group', label: copy.groups[trail[0].definition.group] })
  }
  trail.forEach((crumb, index) => {
    if (index === trail.length - 1) {
      items.push({ kind: 'current', crumb, label: currentLabel })
    } else {
      items.push({ kind: 'link', crumb, label: labelOf(crumb), isOrigin: index === originIndex })
    }
  })

  const iconOf = (crumb: TrailCrumb): ComponentType<SVGProps<SVGSVGElement>> =>
    isDashboard ? HomeIcon : NAV_ICONS[crumb.definition.nav ?? crumb.definition.icon ?? 'dashboard']

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <nav aria-label={copy.label} className="min-w-0">
        <ol className="flex min-w-0 items-center gap-0.5 text-body-sm" data-testid="breadcrumbs">
          {items.map((item, index) => {
            // Narrow screens keep only the last two steps; the rest stay one tap away in the sidebar.
            const isCompactHidden = index < items.length - 2
            const showSeparator = index > 0
            const separatorClassName = index === items.length - 2 ? 'hidden md:block' : ''
            return (
              <li key={index} className={`min-w-0 items-center gap-0.5 ${isCompactHidden ? 'hidden md:flex' : 'flex'}`}>
                {showSeparator && (
                  <ChevronRightIcon className={`size-3.5 shrink-0 text-white/35 ${separatorClassName}`} aria-hidden="true" />
                )}
                {item.kind === 'home' && (
                  <Link
                    to={item.isOrigin && previousUrl ? previousUrl : '/'}
                    title={item.isOrigin ? copy.cameFromHere : undefined}
                    className={`inline-flex items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-white/10 hover:text-white ${
                      item.isOrigin ? 'bg-white/10 text-white ring-1 ring-inset ring-accent/60' : 'text-white/70'
                    }`}
                  >
                    <HomeIcon className="size-4" aria-hidden="true" />
                    <span className="sr-only">{copy.home}</span>
                    {item.isOrigin && <OriginMarker label={copy.cameFromHere} />}
                  </Link>
                )}
                {item.kind === 'group' && <span className="whitespace-nowrap px-1.5 text-white/60">{item.label}</span>}
                {item.kind === 'link' && (
                  <CrumbLink
                    to={item.isOrigin && previousUrl ? previousUrl : item.crumb.path}
                    icon={iconOf(item.crumb)}
                    label={item.label}
                    isOrigin={item.isOrigin}
                    originLabel={copy.cameFromHere}
                  />
                )}
                {item.kind === 'current' && (
                  <span
                    aria-current="page"
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-white/15 py-1 pl-2 pr-3 font-semibold text-white"
                  >
                    {(() => {
                      const Icon = iconOf(item.crumb)
                      return <Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                    })()}
                    <span className={`max-w-[18rem] truncate ${item.label.isCode ? 'font-mono font-medium tracking-tight' : ''}`}>{item.label.text}</span>
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>

      {showFromChip && previousUrl && previousLabel && (
        <Link
          to={previousUrl}
          aria-label={copy.backTo(previousLabel.text)}
          data-testid="breadcrumb-origin"
          className="inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-caption text-white/80 transition-colors hover:border-accent hover:text-white"
        >
          <ArrowUturnLeftIcon className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
          <span className="hidden sm:inline">{copy.from}</span>
          <span className={`max-w-[10rem] truncate font-semibold text-white ${previousLabel.isCode ? 'font-mono font-medium' : ''}`}>
            {previousLabel.text}
          </span>
        </Link>
      )}
    </div>
  )
}

interface CrumbLinkProps {
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  label: BreadcrumbLabel
  isOrigin: boolean
  originLabel: string
}

function CrumbLink({ to, icon: Icon, label, isOrigin, originLabel }: CrumbLinkProps) {
  return (
    <Link
      to={to}
      title={isOrigin ? originLabel : undefined}
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-white ${
        isOrigin ? 'bg-white/10 text-white ring-1 ring-inset ring-accent/60' : 'text-white/75'
      }`}
    >
      <Icon className="size-4 shrink-0 opacity-80" aria-hidden="true" />
      <span className={`max-w-[12rem] truncate ${label.isCode ? 'font-mono tracking-tight' : ''}`}>{label.text}</span>
      {isOrigin && <OriginMarker label={originLabel} />}
    </Link>
  )
}

function OriginMarker({ label }: { label: string }) {
  return (
    <>
      <ArrowUturnLeftIcon className="size-3.5 shrink-0 text-accent" aria-hidden="true" />
      <span className="sr-only">({label})</span>
    </>
  )
}
