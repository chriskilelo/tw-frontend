/**
 * FR-AUTH-010: the server ends a session after 30 minutes without user
 * interaction (EnforceIdleTimeout in tw-backend). Timed requests, such as
 * the notification bell's poll, would otherwise renew the session for ever
 * while a tab sits open and untouched (UAT ISS-001).
 *
 * A request that may run on a timer carries BACKGROUND_REQUEST_HEADER. The
 * axios interceptor in api/client.ts keeps the header only when nobody has
 * used the page since the last request that counted as activity; otherwise
 * it removes it, so the server counts that request as the user being here.
 */
export const BACKGROUND_REQUEST_HEADER = 'X-Background-Request'

const INTERACTION_EVENTS = ['pointerdown', 'mousemove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let lastInteractionAt = 0
let lastActiveRequestAt = 0
let trackers = 0

function recordInteraction() {
  lastInteractionAt = Date.now()
}

/** Starts listening for interaction; returns the matching stop. Safe to nest. */
export function startTrackingUserActivity(): () => void {
  if (trackers === 0) {
    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, recordInteraction, { capture: true, passive: true })
    }
  }
  trackers += 1

  let stopped = false
  return () => {
    if (stopped) {
      return
    }
    stopped = true
    trackers -= 1
    if (trackers === 0) {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, recordInteraction, { capture: true })
      }
    }
  }
}

/** True when nobody has used the page since the last request that counted as activity. */
export function isUserIdleSinceLastRequest(): boolean {
  return lastInteractionAt <= lastActiveRequestAt
}

export function recordActiveRequest(): void {
  lastActiveRequestAt = Date.now()
}

/** Test helper: forget all recorded activity. */
export function resetUserActivityForTests(): void {
  lastInteractionAt = 0
  lastActiveRequestAt = 0
}
