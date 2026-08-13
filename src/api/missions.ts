import client, { type ApiEnvelope } from './client'

/** GET /missions row shape — App\Http\Resources\MissionResource (non-admin fields only). */
export interface Mission {
  id: string
  name: string
  city: string
  active: boolean
}

/** GET /missions — FR-MISS-002. Open to any authenticated user (mission dropdowns, own-mission lookup). */
export async function listMissions(): Promise<Mission[]> {
  const { data } = await client.get<ApiEnvelope<Mission[]>>('/missions')
  return data.data
}
