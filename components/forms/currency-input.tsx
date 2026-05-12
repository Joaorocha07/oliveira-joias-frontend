'use client'

import { forwardRef, useEffect, useRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

function toCents(raw: string) {
  const digits = raw.replace(/\D/g, '')
  return parseInt(digits || '0', 10)
}

function formatDisplay(cents: number) {
  if (cents === 0) return ''
  const value = cents / 100
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, label, error, hint, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    const inputRef = useRef<HTMLInputElement>(null)
    const prevValueRef = useRef(value)

    function setInputRef(node: HTMLInputElement | null) {
      inputRef.current = node
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
    }

    useEffect(() => {
      if (prevValueRef.current !== value && inputRef.current) {
        prevValueRef.current = value
        inputRef.current.value = formatDisplay(Math.round(value * 100))
      }
    }, [value])

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const cents = toCents(e.target.value)
      const num = cents / 100
      e.target.value = formatDisplay(cents)
      prevValueRef.current = num
      onChange(num)
    }

    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          <span className="absolute left-3 text-dark-400 pointer-events-none text-sm select-none">R$</span>
          <input
            ref={setInputRef}
            id={inputId}
            type="text"
            inputMode="numeric"
            defaultValue={formatDisplay(Math.round(value * 100))}
            onChange={handleChange}
            className={cn('input-base pl-10', !!error && 'border-red-400 focus:border-red-400', className)}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
