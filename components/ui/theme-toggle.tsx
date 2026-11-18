'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/theme-context'
import { cn } from '@/lib/cn'

interface ThemeToggleProps {
  className?: string
  size?: number
}

/** Botão ícone que alterna entre modo claro e escuro. */
export function ThemeToggle({ className, size = 13 }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn('transition-colors', className)}
      title={label}
      aria-label={label}
    >
      {isDark ? <Sun size={size} /> : <Moon size={size} />}
    </button>
  )
}
