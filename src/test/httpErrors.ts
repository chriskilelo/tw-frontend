import { AxiosError, AxiosHeaders } from 'axios'

/** An axios error carrying the API's `{ data, errors }` envelope, for mocked API calls in tests. */
export function httpError(status: number, errors: string[] = ['Refused.']): AxiosError {
  return new AxiosError(`Request failed with status code ${status}`, String(status), undefined, undefined, {
    status,
    statusText: '',
    data: { data: null, errors },
    headers: {},
    config: { headers: new AxiosHeaders() },
  })
}
