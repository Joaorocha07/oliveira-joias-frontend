import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-dark-800/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={cn(
        'relative w-full bg-white rounded-2xl border border-gold-100 shadow-xl',
        'flex flex-col max-h-[90vh]',
        sizeClasses[size]
      )}>
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-display text-base md:text-lg font-medium text-dark-700">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors -mr-2"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-4 py-4 md:px-6 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div className="px-4 py-3 md:px-6 md:py-4 border-t border-gold-100 flex items-center justify-end gap-2 flex-shrink-0 bg-cream-50/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
