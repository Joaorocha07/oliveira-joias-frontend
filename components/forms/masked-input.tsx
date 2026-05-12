'use client'

import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export type MaskType = 'cpf' | 'cnpj' | 'phone' | 'cep'

const MAX_DIGITS: Record<MaskType, number> = {
  cpf: 11,
  cnpj: 14,
  phone: 11,
  cep: 8,
}

function applyMask(raw: string, mask: MaskType): string {
  const digits = raw.replace(/\D/g, '').slice(0, MAX_DIGITS[mask])
  switch (mask) {
    case 'cpf':
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    case 'cnpj':
      return digits
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    case 'phone':
      if (digits.length <= 10) {
        return digits
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
      }
      return digits
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
    case 'cep':
      return digits.replace(/(\d{5})(\d{1,3})$/, '$1-$2')
    default:
      return raw
  }
}

interface MaskedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  mask: MaskType
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, onChange, label, error, hint, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      e.target.value = applyMask(e.target.value, mask)
      onChange?.(e)
    }

    return (
      <div className={cn('flex flex-col gap-1', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="text"
          inputMode={mask === 'phone' || mask === 'cep' ? 'numeric' : 'text'}
          onChange={handleChange}
          className={cn('input-base', !!error && 'border-red-400 focus:border-red-400', className)}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  },
)
MaskedInput.displayName = 'MaskedInput'
