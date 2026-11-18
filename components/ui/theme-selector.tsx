'use client'

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useTheme } from '@/context/theme-context'
import { cn } from '@/lib/cn'
import type { ThemePreference } from '@/types'

const OPTIONS: { value: ThemePreference; label: string; icon: LucideIcon }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

/** Seletor segmentado Claro / Escuro / Sistema. */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme()

  return (
    <div role="radiogroup" aria-label="Tema" className="inline-flex gap-1 rounded-lg border border-gold-100 bg-cream-50 p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={cn(
              'flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors',
              active
                ? 'bg-surface text-gold-600 shadow-sm border border-gold-200'
                : 'text-dark-400 hover:text-dark-600 border border-transparent',
            )}
          >
            <Icon size={15} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
