import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'gold'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-[rgba(91,140,91,0.1)] text-[#5B8C5B] border-[rgba(91,140,91,0.25)]',
  warning: 'bg-[rgba(201,168,76,0.1)] text-[#C9A84C] border-[rgba(201,168,76,0.25)]',
  danger:  'bg-[rgba(199,91,91,0.1)] text-[#C75B5B] border-[rgba(199,91,91,0.25)]',
  info:    'bg-[rgba(91,142,184,0.1)] text-[#5B8EB8] border-[rgba(91,142,184,0.25)]',
  gray:    'bg-dark-200/20 text-dark-300 border-dark-200/40',
  gold:    'bg-gold-50 text-gold-500 border-gold-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}
