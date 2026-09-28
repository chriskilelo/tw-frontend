import type { ComponentType, SVGProps } from 'react'
import { Link } from 'react-router-dom'
import {
  BellAlertIcon,
  BuildingLibraryIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  TagIcon,
} from '@heroicons/react/24/outline'
import type { SearchResult, SearchResultType } from '../../api/search'
import { SearchSnippet } from '../../components/SearchSnippet'
import { useI18n } from '../../i18n/context'
import { formatDate, formatDateTime, localeFor } from '../../lib/formatters'
import { AlertStatusBadge } from '../alerts/AlertStatusBadge'
import { InquiryStatusBadge } from '../inquiries/InquiryStatusBadge'
import { InquirySubTypeBadge } from '../inquiries/InquirySubTypeBadge'
import { ReportStatusBadge } from '../reports/ReportStatusBadge'
import { SearchResultTypeBadge } from './SearchResultTypeBadge'

/** Same colour per record type as SearchResultTypeBadge (alert = accent, inquiry = info, report = neutral). */
const TYPE_TILE: Record<SearchResultType, { className: string; icon: ComponentType<SVGProps<SVGSVGElement>> }> = {
  alert: { className: 'bg-accent-soft text-accent-soft-text', icon: BellAlertIcon },
  inquiry: { className: 'bg-info-soft text-info-soft-text', icon: ChatBubbleLeftRightIcon },
  periodic_report: { className: 'bg-section-bg text-text-secondary', icon: DocumentTextIcon },
}

function StatusBadge({ result }: { result: SearchResult }) {
  switch (result.type) {
    case 'alert':
      return <AlertStatusBadge status={result.status} />
    case 'inquiry':
      return <InquiryStatusBadge status={result.status} />
    case 'periodic_report':
      return <ReportStatusBadge status={result.status} />
  }
}

/**
 * FR-SEARCH-003: every card shows the record type, a title, the mission, the date and the
 * highlighted snippet, and the whole card opens the record. The title link's ::after overlay
 * stretches over the card, so the link keeps a short accessible name.
 */
export function SearchResultCard({ result }: { result: SearchResult }) {
  const { t, language } = useI18n()
  const locale = localeFor(language)
  const tile = TYPE_TILE[result.type]
  const TileIcon = tile.icon

  const title =
    result.type === 'alert'
      ? `${result.country} · ${t.alerts.intelligenceType[result.intelligence_type] ?? result.intelligence_type}`
      : result.type === 'periodic_report'
        ? t.search.results.reportTitle(result.reference_number)
        : result.summary

  return (
    <li>
      <article
        data-testid="search-result"
        className="group relative flex gap-3.5 rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:border-border-muted hover:shadow-md has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary has-[a:focus-visible]:ring-offset-2 sm:p-5"
      >
        <span className={`hidden size-10 shrink-0 place-items-center rounded-lg sm:grid ${tile.className}`} aria-hidden="true">
          <TileIcon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="font-mono text-body-sm font-medium text-text-secondary">{result.reference_number}</span>
            <SearchResultTypeBadge type={result.type} />
            <StatusBadge result={result} />
            {result.type === 'inquiry' && result.sub_type === 'dispute_or_complaint' && <InquirySubTypeBadge subType={result.sub_type} />}
          </div>

          <h3 className="mt-2 text-h3 leading-snug">
            <Link
              to={result.link}
              className="text-primary after:absolute after:inset-0 after:rounded-xl group-hover:underline focus-visible:shadow-none"
            >
              {title}
            </Link>
          </h3>

          {result.type === 'alert' && result.sector && (
            <p className="mt-1 inline-flex items-center gap-1.5 text-caption font-medium text-text-secondary">
              <TagIcon className="size-3.5 text-text-muted" aria-hidden="true" />
              {result.sector}
            </p>
          )}

          {result.snippet && (
            <p className="mt-2 line-clamp-3 border-l-2 border-border pl-3 text-body-sm text-text-secondary">
              <SearchSnippet snippet={result.snippet} />
            </p>
          )}

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-text-secondary">
            {result.mission && (
              <span className="inline-flex items-center gap-1.5">
                <BuildingLibraryIcon className="size-3.5 text-text-muted" aria-hidden="true" />
                {result.mission}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarDaysIcon className="size-3.5 text-text-muted" aria-hidden="true" />
              <time dateTime={result.date} title={formatDateTime(result.date, locale)}>
                {formatDate(result.date, locale)}
              </time>
            </span>
          </p>
        </div>

        <ChevronRightIcon
          className="hidden size-5 shrink-0 self-center text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary sm:block"
          aria-hidden="true"
        />
      </article>
    </li>
  )
}
