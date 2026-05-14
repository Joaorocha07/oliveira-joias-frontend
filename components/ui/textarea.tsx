import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  wrapperClassName?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, wrapperClassName, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'input-base resize-y min-h-[80px]',
            error && 'input-error',
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-[#C75B5B]">{error}</p>}
        {hint && !error && <p className="text-xs text-dark-300">{hint}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'
