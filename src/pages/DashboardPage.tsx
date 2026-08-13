import { useI18n } from '../i18n/context'

interface StatTile {
  key: string
  label: string
  value: string
}

// Placeholder tiles — populated with real counts by role-specific sessions (Session 21+).
function useStatTiles(): StatTile[] {
  const { t } = useI18n()
  return [
    { key: 'alerts', label: t.nav.alerts, value: '—' },
    { key: 'inquiries', label: t.nav.inquiries, value: '—' },
    { key: 'directives', label: t.nav.directives, value: '—' },
    { key: 'reports', label: t.nav.reports, value: '—' },
  ]
}

export default function DashboardPage() {
  const { t } = useI18n()
  const tiles = useStatTiles()

  return (
    <div className="p-6">
      <h1 className="text-h1 text-primary">{t.dashboard.title}</h1>
      <p className="mt-2 text-body text-text-secondary">{t.dashboard.placeholder}</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-lg border border-border bg-white p-4 shadow-sm">
            <p className="text-body-sm text-text-muted">{tile.label}</p>
            <p className="mt-1 font-mono text-h1 text-primary">{tile.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
