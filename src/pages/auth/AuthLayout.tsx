import type { ReactNode } from 'react'
import en from '../../i18n/en'

interface AuthLayoutProps {
  children: ReactNode
}

/** Shared dark-navy header + centered card shell for the three unauthenticated auth pages (CLAUDE.md Section 13). */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="bg-primary px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-baseline gap-2">
          <span className="text-h3 font-bold text-white">{en.nav.brandTitle}</span>
          <span className="text-body-sm text-white/70">{en.nav.brandSubtitle}</span>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-sm rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </main>
    </div>
  )
}
