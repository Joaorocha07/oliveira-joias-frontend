import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftAddon?: ReactNode
  rightAddon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, rightAddon, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftAddon && (
            <span className="absolute left-3 text-gold-600 pointer-events-none select-none flex items-center">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'input-base',
              !!leftAddon && 'pl-10',
              !!rightAddon && 'pr-10',
              !!error && 'input-error',
              className
            )}
            {...props}
          />
          {rightAddon && (
            <span className="absolute right-3 text-gold-600 pointer-events-none select-none flex items-center">
              {rightAddon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-[#C75B5B]">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
