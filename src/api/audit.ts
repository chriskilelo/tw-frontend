import client, { type ApiEnvelope } from './client'

/** App\Http\Resources\AuditLogResource — FR-AUDIT-005/006. */
export interface AuditLogEntry {
  id: string
  user_id: string | null
  user_full_name?: string | null
  ministry_id: string | null
  action: string
  affected_entity_type: string
  affected_entity_id: string | null
  changes: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
}

export interface AuditLogFilters {
  page?: number
  per_page?: number
  action?: string
  from?: string
  to?: string
}

/** System Administrator: whole platform. Ministry Administrator: own department's administrative entries. */
export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<ApiEnvelope<AuditLogEntry[]>> {
  const { data } = await client.get<ApiEnvelope<AuditLogEntry[]>>('/audit-logs', { params: filters })
  return data
}
