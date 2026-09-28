import type { ReactNode } from 'react'
import en from '../../i18n/en'
import logoLockup from '../../assets/tw_lockup_full.png'

interface AuthLayoutProps {
  children: ReactNode
}

// Only the platform-name lead-in of the tagline gets the signature yellow; the rest keeps its original muted-white color.
const [taglineHighlight, taglineRest] = en.auth.tagline.split(' — ')

/** Shared dark-navy header + centered card shell for the three unauthenticated auth pages (CLAUDE.md Section 13). */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg">
      <header className="bg-primary px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-5xl text-center sm:text-left">
          <span className="text-h3 font-bold text-white">{en.nav.brandTitle}</span>
          <p className="mt-1 text-body-sm text-white/70">
            <span className="font-bold text-accent">{taglineHighlight}</span>
            {taglineRest ? <span className="hidden sm:inline"> — {taglineRest}</span> : null}
          </p>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="flex w-full max-w-md flex-col items-center">
          {/* Logo stays at 7/8 of the card width at every viewport. */}
          <img
            src={logoLockup}
            alt="Republic of Kenya — Ministry of Investments, Trade and Industry, State Department for Trade"
            className="mb-6 h-auto w-[87.5%]"
          />
          <div className="w-full rounded-lg border border-border bg-white p-6 shadow-sm sm:p-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
