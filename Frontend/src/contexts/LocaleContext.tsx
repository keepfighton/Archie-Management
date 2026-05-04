import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LOCALE,
  type SupportedLanguage,
  type SupportedLocale,
  getLanguageFromLocale,
  normalizeLocale,
  translate,
} from '@/i18n/messages'

export const LOCALE_STORAGE_KEY = 'nexone.locale'

type TranslateVariables = Record<string, string | number>

type LocaleContextValue = {
  locale: SupportedLocale
  language: SupportedLanguage
  setLocale: (locale: string) => void
  t: (key: string, fallback?: string, variables?: TranslateVariables) => string
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

function getInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY))
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(getInitialLocale)
  const language = getLanguageFromLocale(locale)

  const setLocale = useCallback((nextLocale: string) => {
    setLocaleState(normalizeLocale(nextLocale))
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
    document.documentElement.lang = language
  }, [language, locale])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY) {
        setLocaleState(normalizeLocale(event.newValue))
      }
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const t = useCallback((key: string, fallback?: string, variables?: TranslateVariables) => (
    translate(locale, key, fallback, variables)
  ), [locale])

  const value = useMemo(() => ({
    locale,
    language,
    setLocale,
    t,
  }), [language, locale, setLocale, t])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
