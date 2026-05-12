import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'gold'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-green-700 border-green-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  danger:  'bg-red-50 text-red-700 border-red-100',
  info:    'bg-blue-50 text-blue-700 border-blue-100',
  gray:    'bg-gray-50 text-gray-600 border-gray-100',
  gold:    'bg-gold-50 text-gold-700 border-gold-200',
}

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
}

export function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  )
}
