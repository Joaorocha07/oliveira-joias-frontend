'use client'

import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
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
  ({ label, error, hint, leftAddon, rightAddon, wrapperClassName, className, id, type, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const [senhaVisivel, setSenhaVisivel] = useState(false)
    const isPassword = type === 'password'
    const resolvedType = isPassword ? (senhaVisivel ? 'text' : 'password') : type

    // Campos de senha ganham automaticamente o "olhinho" de mostrar/ocultar,
    // a menos que a tela já esteja usando o rightAddon para outra coisa.
    const resolvedRightAddon = rightAddon ?? (isPassword ? (
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setSenhaVisivel((prev) => !prev)}
        className="pointer-events-auto text-dark-300 hover:text-gold-600 transition-colors"
        aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
      >
        {senhaVisivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    ) : undefined)

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
            type={resolvedType}
            className={cn(
              'input-base',
              !!leftAddon && 'pl-10',
              !!resolvedRightAddon && 'pr-10',
              !!error && 'input-error',
              className
            )}
            {...props}
          />
          {resolvedRightAddon && (
            <span className="absolute right-3 text-gold-600 pointer-events-none select-none flex items-center">
              {resolvedRightAddon}
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
