import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-gold-500 text-white border-0 font-medium tracking-[0.3px]',
    'hover:bg-gold-400 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(201,168,76,0.25)]',
    'active:bg-gold-600 active:translate-y-0 active:shadow-none',
  ].join(' '),
  secondary: [
    'bg-transparent text-gold-500 border-[1.5px] border-gold-500',
    'hover:bg-gold-50',
    'active:bg-gold-100',
  ].join(' '),
  ghost: [
    'bg-transparent text-dark-400 border border-transparent',
    'hover:bg-gold-50',
    'active:bg-gold-100',
  ].join(' '),
  danger: [
    'bg-[#C75B5B] text-white border-0',
    'hover:bg-[#D46E6E] hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(199,91,91,0.25)]',
    'active:bg-[#B04A4A] active:translate-y-0 active:shadow-none',
  ].join(' '),
  'danger-ghost': [
    'bg-transparent text-[#C75B5B] border border-transparent',
    'hover:bg-[rgba(199,91,91,0.06)]',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm:   'h-8 px-3.5 text-xs gap-1',
  md:   'h-[42px] sm:h-[38px] px-5 text-sm gap-1.5',
  lg:   'h-11 sm:h-10 px-6 text-sm gap-2',
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
        'transition-all duration-200 cursor-pointer select-none touch-manipulation',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40',
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
