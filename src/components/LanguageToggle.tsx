import type { LanguagePreference } from '../i18n'
import { useI18n } from '../i18n/context'

const LANGUAGES: LanguagePreference[] = ['en', 'sw']

/** FR-I18N-002: toggles the authenticated user's language preference. */
export function LanguageToggle() {
  const { language, t, setLanguage } = useI18n()

  return (
    <div className="flex items-center gap-1" role="group" aria-label={t.language.toggleLabel}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          aria-pressed={language === lang}
          onClick={() => setLanguage(lang)}
          className={`rounded px-2 py-1 text-caption font-semibold transition-colors ${
            language === lang ? 'bg-accent text-accent-text' : 'text-white hover:bg-primary-light'
          }`}
        >
          {t.language[lang]}
        </button>
      ))}
    </div>
  )
}
