import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

// ── CARD ───────────────────────────────────────────────────────
interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={cn(
      'bg-white rounded-xl border border-gold-100 shadow-sm',
      padding === 'md' && 'p-5',
      padding === 'sm' && 'p-3',
      className
    )}>
      {children}
    </div>
  )
}

// ── CARD HEADER ────────────────────────────────────────────────
interface CardHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, actions, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div>
        <h2 className="font-display text-lg font-medium text-dark-700">{title}</h2>
        {subtitle && <p className="text-xs text-dark-300 mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
