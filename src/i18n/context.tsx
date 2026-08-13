import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import resources, { type LanguagePreference } from './index'
import en from './en'
import { useAuth, AUTH_QUERY_KEY } from '../hooks/useAuth'
import { updatePreferences } from '../api/auth'

interface I18nContextValue {
  language: LanguagePreference
  t: typeof en
  setLanguage: (language: LanguagePreference) => void
}

const I18nContext = createContext<I18nContextValue | null>(null)

/**
 * Session 20: language starts from the authenticated user's stored preference
 * (FR-I18N-002) and defaults to 'en' before that loads or when unauthenticated.
 * setLanguage() updates state optimistically, then persists via PATCH /me/preferences
 * and refreshes the cached GET /me response so a reload doesn't revert the toggle.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [language, setLanguageState] = useState<LanguagePreference>('en')

  useEffect(() => {
    if (user?.language_preference) {
      setLanguageState(user.language_preference)
    }
  }, [user?.language_preference])

  const setLanguage = (next: LanguagePreference) => {
    const previous = language
    setLanguageState(next)
    updatePreferences({ language_preference: next })
      .then(() => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }))
      .catch(() => setLanguageState(previous))
  }

  return (
    <I18nContext.Provider value={{ language, t: resources[language], setLanguage }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}
