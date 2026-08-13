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
