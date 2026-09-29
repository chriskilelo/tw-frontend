import '@testing-library/jest-dom'

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
