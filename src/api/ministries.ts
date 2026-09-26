import client, { type ApiEnvelope } from './client'

/** GET /ministries row — ADR-006 department registry. */
export interface Department {
  id: string
  name: string
  active: boolean
}

/** System Administrator: every department. Ministry Administrator: its own only. */
export async function listDepartments(): Promise<Department[]> {
  const { data } = await client.get<ApiEnvelope<Department[]>>('/ministries')
  return data.data
}

/** POST /ministries — System Administrator only (onboard a new department). */
export async function createDepartment(name: string): Promise<Department> {
  const { data } = await client.post<ApiEnvelope<Department>>('/ministries', { name })
  return data.data
}
