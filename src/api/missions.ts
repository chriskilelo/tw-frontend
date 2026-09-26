import client, { type ApiEnvelope } from './client'

/** GET /missions row shape — App\Http\Resources\MissionResource (non-admin fields only). */
export interface Mission {
  id: string
  name: string
  city: string
  active: boolean
  /** Administrators only; a Ministry Administrator receives its own department's posting only. */
  mission_ministry_links?: MissionPosting[]
}

/** One department's attache posting at a mission (BR-004). */
export interface MissionPosting {
  ministry_id: string
  active_attache_user_id: string | null
  active_attache?: { id: string; full_name: string } | null
}

/** GET /missions — FR-MISS-002. Open to any authenticated user (mission dropdowns, own-mission lookup). */
export async function listMissions(): Promise<Mission[]> {
  const { data } = await client.get<ApiEnvelope<Mission[]>>('/missions')
  return data.data
}

/**
 * PATCH /mission-links/{mission} — ADR-006. Sets (or, with null, clears) the attache a
 * department has posted to a mission. ministry_id is needed only from a System Administrator.
 */
export async function updateMissionPosting(
  missionId: string,
  payload: { active_attache_user_id: string | null; ministry_id?: string },
): Promise<MissionPosting & { mission_id: string }> {
  const { data } = await client.patch<ApiEnvelope<MissionPosting & { mission_id: string }>>(`/mission-links/${missionId}`, payload)
  return data.data
}
