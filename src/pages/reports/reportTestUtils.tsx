import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { useAuth } from '../../hooks/useAuth'
import type { PeriodicReport, PeriodicReportDetail, ReportSectionDetail } from '../../api/reports'
import { I18nProvider } from '../../i18n/context'
import { LocationProbe } from './LocationProbe'

/** Shared fixtures for the Periodic Report Engine page tests. */

export const MISSION = { id: 'mission-1', name: 'London', city: 'London', host_country: 'United Kingdom' }

export function authAs(roleName: string, missionId: string | null = null): ReturnType<typeof useAuth> {
  return {
    user: {
      id: 'user-1',
      full_name: 'Test User',
      email: 'user@sdt.go.ke',
      role_id: 'role-1',
      mission_id: missionId,
      ministry_id: 'ministry-1',
      status: 'active',
      language_preference: 'en',
      email_notification_preferences: null,
    },
    role: { id: 'role-1', name: roleName, layer: '2', scope: missionId ? 'mission' : 'ministry' },
    permissions: [],
    isLoading: false,
    isAuthenticated: true,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>
}

export function narrativeSection(overrides: Partial<ReportSectionDetail> = {}): ReportSectionDetail {
  return {
    id: 'section-intro',
    report_template_section_id: 'tpl-1',
    section_title: 'Introduction',
    section_type: 'narrative',
    section_order: 1,
    column_schema: null,
    guidance_text: 'Outline, background, objectives, limitations/assumptions',
    table: null,
    content: '',
    data_rows: [],
    completion: 'empty',
    updated_at: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

export function assetSection(overrides: Partial<ReportSectionDetail> = {}): ReportSectionDetail {
  return {
    id: 'section-assets',
    report_template_section_id: 'tpl-8',
    section_title: 'Asset Register',
    section_type: 'structured_table',
    section_order: 2,
    column_schema: [
      { name: 'Item Number', type: 'integer', mandatory: true },
      { name: 'Item Description', type: 'text', mandatory: true },
      { name: 'Status', type: 'selection', mandatory: true, options: ['Serviceable', 'Needs Repair'] },
      { name: 'Remarks', type: 'text', mandatory: false },
    ],
    guidance_text: null,
    table: { label_columns: [], prepopulated: false, total: null, max_rows: 200 },
    content: null,
    data_rows: [],
    completion: 'empty',
    updated_at: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

export function aieSection(overrides: Partial<ReportSectionDetail> = {}): ReportSectionDetail {
  return {
    id: 'section-aie',
    report_template_section_id: 'tpl-9',
    section_title: 'AIE Allocations Analysis',
    section_type: 'structured_table',
    section_order: 3,
    column_schema: [
      { name: 'Budget Code', type: 'text', mandatory: true },
      { name: 'Head Description', type: 'text', mandatory: true },
      { name: 'Quarter Allocation', type: 'numeric', mandatory: true },
      { name: 'Deficit/Surplus', type: 'numeric', mandatory: false },
    ],
    guidance_text: null,
    table: {
      label_columns: ['Budget Code', 'Head Description'],
      prepopulated: true,
      total: { label: 'TOTAL', label_column: 'Head Description', sum_columns: ['Quarter Allocation', 'Deficit/Surplus'], exclude_labels: ['Bank Account Balance'] },
      max_rows: 200,
    },
    content: null,
    data_rows: [
      { id: 'row-1', row_order: 1, row_data: { 'Budget Code': '2110300', 'Head Description': 'Personal Allowances-FSA', 'Quarter Allocation': 1200 } },
      { id: 'row-2', row_order: 2, row_data: { 'Budget Code': '2210100', 'Head Description': 'Utilities', 'Quarter Allocation': 800.5 } },
      { id: 'row-3', row_order: 3, row_data: { 'Budget Code': 'N/A', 'Head Description': 'Bank Account Balance', 'Quarter Allocation': 5000 } },
    ],
    completion: 'started',
    updated_at: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

export function conclusionSection(overrides: Partial<ReportSectionDetail> = {}): ReportSectionDetail {
  return narrativeSection({ id: 'section-conclusion', report_template_section_id: 'tpl-10', section_title: 'Conclusion', section_order: 4, guidance_text: null, ...overrides })
}

export function reportRow(overrides: Partial<PeriodicReport> = {}): PeriodicReport {
  return {
    id: 'report-1',
    reporting_period_label: 'Q1 2026',
    period_start_date: '2026-07-01',
    period_end_date: '2026-09-30',
    template_version: 1,
    status: 'draft',
    submitted_at: null,
    is_late: false,
    deadline: '2026-10-15',
    days_to_deadline: 10,
    is_overdue: false,
    days_overdue: null,
    compliance_status: 'draft_in_progress',
    mission: MISSION,
    ministry: { id: 'ministry-1', name: 'State Department for Trade' },
    authored_by: { id: 'attache-1', full_name: 'Purity Samanthe' },
    created_at: '2026-09-20T08:00:00Z',
    updated_at: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

export function reportDetail(overrides: Partial<PeriodicReportDetail> = {}): PeriodicReportDetail {
  return {
    ...reportRow(),
    submitted_by: null,
    allowed_actions: { edit: true, submit: true, carry_forward: false, discard: true },
    carry_forward_source: null,
    sections: [narrativeSection(), assetSection(), aieSection(), conclusionSection()],
    progress: { total: 4, complete: 0, started: 1, empty: 3 },
    last_edited_at: '2026-10-01T08:00:00Z',
    ...overrides,
  }
}

export function axiosError(status: number, errors: string[] = ['Denied.'], data: unknown = null) {
  return { isAxiosError: true, response: { status, data: { data, errors } } }
}

export function renderRoute(path: string, routePath: string, element: ReactNode, extra: { path: string; element: ReactNode }[] = []) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } } })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            {extra.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { ...view, queryClient }
}
