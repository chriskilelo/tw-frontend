import { describe, expect, it } from 'vitest'
import { resolveTrail } from './breadcrumbTrail'

const paths = (pathname: string) => resolveTrail(pathname).map((crumb) => crumb.path)

describe('resolveTrail', () => {
  it('TC-UI-003: walks from a record back up to its module', () => {
    expect(paths('/inquiries/0197-abc')).toEqual(['/inquiries', '/inquiries/0197-abc'])
    expect(paths('/admin/users/42')).toEqual(['/admin/users', '/admin/users/42'])
    expect(paths('/sdt/config/kpi-settings')).toEqual(['/config', '/sdt/config/kpi-settings'])
  })

  it('TC-UI-003-B: prefers a literal route over a parameter route', () => {
    const [, create] = resolveTrail('/alerts/new')
    expect(create.definition.page).toBe('submitAlert')

    const [, summary] = resolveTrail('/directives/summary')
    expect(summary.definition.nav).toBe('directivesSummary')
  })

  it('TC-UI-003-C: exposes URL parameters and section groups', () => {
    const [, country] = resolveTrail('/search/countries/United%20Kingdom')
    expect(country.params.country).toBe('United%20Kingdom')

    expect(resolveTrail('/kpi/targets')[0].definition.group).toBe('kpi')
    expect(resolveTrail('/admin/audit-log')[0].definition.group).toBe('administration')
  })

  it('TC-UI-003-D: tolerates a trailing slash and returns nothing for unknown paths', () => {
    expect(paths('/alerts/')).toEqual(['/alerts'])
    expect(resolveTrail('/no-such-page')).toEqual([])
  })
})
