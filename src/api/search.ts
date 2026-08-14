import client, { type ApiEnvelope } from './client'

export type SearchResultType = 'alert' | 'inquiry' | 'periodic_report'

export interface SearchResult {
  type: SearchResultType
  id: string
  reference_number: string
  summary: string
  mission: string | null
  mission_id: string | null
  date: string
  snippet: string
  rank: number
  link: string
}

/**
 * GET /search — FR-SEARCH-001 to 003. Merges full-text results across
 * alerts, inquiries, and periodic reports (App\Services\SearchService),
 * ranked by ts_rank. Callers that only want one record type (e.g.
 * AlertListPage) filter the returned list by `type` client-side; the
 * backend has no per-type filter parameter.
 */
export async function search(query: string): Promise<SearchResult[]> {
  const { data } = await client.get<ApiEnvelope<SearchResult[]>>('/search', { params: { q: query } })
  return data.data
}

export interface CountryProfileAlert {
  id: string
  reference_number: string
  intelligence_type: string
  sector: string | null
  urgency: string | null
  status: string
  mission: string | null
  submitted_by: string | null
  created_at: string
}

/**
 * GET /search/countries/{country} — FR-SEARCH-004. App\Services\SearchService::countryProfile()
 * aggregates alerts only (neither inquiries nor periodic_reports carries a `country` column,
 * only reachable indirectly via mission.host_country); by_intelligence_type/by_sector are
 * counts keyed by that value across every alert for the country, not just the 10 shown below.
 */
export interface CountryProfile {
  country: string
  total_alerts: number
  by_intelligence_type: Record<string, number>
  by_sector: Record<string, number>
  recent_alerts: CountryProfileAlert[]
}

export async function getCountryProfile(country: string): Promise<CountryProfile> {
  const { data } = await client.get<ApiEnvelope<CountryProfile>>(`/search/countries/${encodeURIComponent(country)}`)
  return data.data
}
