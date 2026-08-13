import type { Config } from 'tailwindcss'

// Custom breakpoints matching NFR-RESP-001's five viewport classes exactly
// (TDD-ADR-003, TW-TDD-001 Section 5.6) rather than Tailwind's defaults.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      sm: '481px', // Mobile Landscape / Small Tablet: 481px - 768px
      md: '769px', // Tablet / Medium Desktop: 769px - 1024px
      lg: '1025px', // Large Desktop / High Resolution: 1025px - 1440px
      xl: '1441px', // Ultra-Wide / Extra Large: 1441px and above
    },
    extend: {
      // Every value below reads from the CSS custom properties defined once in
      // src/styles/tokens.css (CLAUDE.md Section 13) rather than duplicating hex values.
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          lighter: 'var(--color-primary-lighter)',
          lightest: 'var(--color-primary-lightest)',
        },
        surface: {
          dark: 'var(--color-surface-dark)',
          elevated: 'var(--color-surface-elevated)',
          hover: 'var(--color-surface-hover)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          text: 'var(--color-accent-text)',
          light: 'var(--color-accent-light)',
          'light-text': 'var(--color-accent-light-text)',
          soft: 'var(--color-accent-soft)',
          'soft-text': 'var(--color-accent-soft-text)',
        },
        atrisk: {
          DEFAULT: 'var(--color-at-risk)',
          text: 'var(--color-at-risk-text)',
          soft: 'var(--color-at-risk-soft)',
          'soft-text': 'var(--color-at-risk-soft-text)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          text: 'var(--color-success-text)',
          soft: 'var(--color-success-soft)',
          'soft-text': 'var(--color-success-soft-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          text: 'var(--color-danger-text)',
          soft: 'var(--color-danger-soft)',
          'soft-text': 'var(--color-danger-soft-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          text: 'var(--color-info-text)',
          soft: 'var(--color-info-soft)',
          'soft-text': 'var(--color-info-soft-text)',
        },
        directive: {
          DEFAULT: 'var(--color-directive)',
          text: 'var(--color-directive-text)',
          soft: 'var(--color-directive-soft)',
          'soft-text': 'var(--color-directive-soft-text)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          muted: 'var(--color-border-muted)',
        },
        page: {
          bg: 'var(--color-page-bg)',
        },
        section: {
          bg: 'var(--color-section-bg)',
        },
        text: {
          muted: 'var(--color-text-muted)',
          secondary: 'var(--color-text-secondary)',
          primary: 'var(--color-text-primary)',
        },
      },
      fontFamily: {
        sans: ['Public Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['Roboto Mono', 'SF Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        h1: ['1.75rem', { lineHeight: '1.25', fontWeight: '700' }],
        h2: ['1.25rem', { lineHeight: '1.25', fontWeight: '600' }],
        h3: ['1.0625rem', { lineHeight: '1.25', fontWeight: '600' }],
        h4: ['0.9375rem', { lineHeight: '1.3', fontWeight: '600' }],
        body: ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['0.75rem', { lineHeight: '1.4', fontWeight: '400' }],
        button: ['0.8125rem', { lineHeight: '1', fontWeight: '600' }],
      },
    },
  },
} satisfies Config
