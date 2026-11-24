import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

/**
 * Testing Library's findBy queries and waitFor give up after 1 second by default. Under a full parallel run a first render
 * can take longer than that, which made passing tests fail at random; 5 seconds sits well
 * inside Vitest's 15-second test timeout (vite.config.ts) and only slows down a real failure.
 */
configure({ asyncUtilTimeout: 5000 })

/**
 * jsdom has no ResizeObserver; Recharts' `responsive` charts (the dashboards) subscribe to
 * one to size themselves. A no-op stub lets them mount; they render at zero size, which is
 * fine because tests assert on the text, tables and summaries around each chart.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
