'use client'

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { ResolvedTheme, ThemePreference } from '@/types'
import { THEME_STORAGE_KEY, isThemePreference, resolveTheme } from '@/lib/theme'

interface ThemeContextType {
  /** O que o usuário escolheu (inclui 'system') */
  preference: ThemePreference
  /** O tema efetivamente aplicado na tela */
  theme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
  /** Alterna entre claro e escuro (sai do modo 'system') */
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | null>(null)

const DARK_QUERY = '(prefers-color-scheme: dark)'
const CHANGE_EVENT = 'oj-tema-change'

// ── Fonte da verdade fora do React: localStorage + media query do SO ──────────

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function readSystemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

function readTheme(): ResolvedTheme {
  return resolveTheme(readPreference(), readSystemDark())
}

/** Aplica a classe .dark no <html> (mesma lógica do THEME_INIT_SCRIPT). */
function applyTheme() {
  document.documentElement.classList.toggle('dark', readTheme() === 'dark')
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY)
  const handle = () => {
    applyTheme()
    onChange()
  }
  media.addEventListener('change', handle)       // SO trocou de tema
  window.addEventListener('storage', handle)     // outra aba trocou a preferência
  window.addEventListener(CHANGE_EVENT, handle)  // esta aba trocou a preferência
  return () => {
    media.removeEventListener('change', handle)
    window.removeEventListener('storage', handle)
    window.removeEventListener(CHANGE_EVENT, handle)
  }
}

// No servidor não há preferência; o THEME_INIT_SCRIPT já cuidou da classe no <html>.
const getServerPreference = (): ThemePreference => 'system'
const getServerTheme = (): ResolvedTheme => 'light'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, getServerPreference)
  const theme = useSyncExternalStore(subscribe, readTheme, getServerTheme)

  // Garante a classe correta caso o script inline não tenha rodado (ex.: navegação client-side
  // vinda de uma página antiga em cache). Lê das fontes reais, nunca de estado defasado.
  useEffect(() => {
    applyTheme()
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // localStorage indisponível (modo privado restrito) — nada a persistir
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const toggleTheme = useCallback(() => {
    setPreference(readTheme() === 'dark' ? 'light' : 'dark')
  }, [setPreference])

  return (
    <ThemeContext.Provider value={{ preference, theme, setPreference, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>')
  return ctx
}
