import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary:        'bg-gold-500 text-dark-800 hover:bg-gold-400 border border-gold-600 font-medium',
  secondary:      'bg-white text-dark-600 hover:bg-cream-100 border border-gold-200',
  ghost:          'bg-transparent text-dark-500 hover:bg-cream-200 border border-transparent',
  danger:         'bg-red-600 text-white hover:bg-red-700 border border-red-700',
  'danger-ghost': 'bg-transparent text-red-600 hover:bg-red-50 border border-transparent',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm:   'h-8 px-2.5 text-xs gap-1',
  md:   'h-11 sm:h-9 px-3.5 text-sm gap-1.5',
  lg:   'h-11 sm:h-10 px-5 text-sm gap-2',
  icon: 'h-11 w-11 sm:h-8 sm:w-8 p-0',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-normal',
        'transition-all duration-150 cursor-pointer select-none touch-manipulation',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
        'active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
      {!loading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  )
)
Button.displayName = 'Button'
