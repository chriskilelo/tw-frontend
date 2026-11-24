/**
 * Router state the submit form passes to the new alert's page, so that page can confirm the
 * submission (ISS-006) and name any file that could not be attached once the alert was saved.
 */
export interface AlertSubmittedState {
  alertSubmitted: { failedFiles: string[] }
}

export function alertSubmittedState(failedFiles: string[]): AlertSubmittedState {
  return { alertSubmitted: { failedFiles } }
}

/** The submission notice carried in router state, or null when the page was opened another way. */
export function readAlertSubmitted(state: unknown): AlertSubmittedState['alertSubmitted'] | null {
  if (typeof state !== 'object' || state === null || !('alertSubmitted' in state)) {
    return null
  }
  const notice = (state as Partial<AlertSubmittedState>).alertSubmitted
  if (!notice || !Array.isArray(notice.failedFiles)) {
    return null
  }
  return { failedFiles: notice.failedFiles.filter((name): name is string => typeof name === 'string') }
}
