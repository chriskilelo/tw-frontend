import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'

// Self-hosted per TDD-ADR-014 / 17_TW_Design_Tokens.md: Public Sans (headings/body/UI),
// Roboto Mono (reference numbers, tabular figures). Weights match what tokens.css's
// font-weight custom properties (--weight-regular/-semibold/-bold) actually use.
import '@fontsource/public-sans/400.css'
import '@fontsource/public-sans/600.css'
import '@fontsource/public-sans/700.css'
import '@fontsource/roboto-mono/400.css'
import '@fontsource/roboto-mono/600.css'

import './index.css'
import { AppRouter } from './router'
import { createQueryClient } from './lib/queryClient'

const queryClient = createQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  </StrictMode>,
)
