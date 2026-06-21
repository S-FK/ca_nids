import { useEffect, useState, useCallback } from 'react'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ca-xnids-theme'

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  // Respect OS preference on first visit only
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * UI-only theme toggle. Purely presentational — does not touch the
 * Zustand store, WebSocket logic, or any business state. Persists choice
 * to localStorage and flips the `dark` class on <html>, which all the
 * CSS-variable tokens in index.css key off of.
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggleTheme }
}
