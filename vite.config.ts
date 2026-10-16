/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    // Form tests type through userEvent in jsdom; with every worker busy, a long one can pass
    // Vitest's 5s default and fail at random although nothing is wrong. Assertions are unchanged.
    testTimeout: 15_000,
  },
})
