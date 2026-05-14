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
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Container */}
      <div className={cn(
        'relative w-full bg-white rounded-2xl flex flex-col max-h-[90vh]',
        'border border-[rgba(232,213,163,0.3)]',
        'shadow-[0_20px_60px_rgba(26,21,16,0.15)]',
        sizeClasses[size]
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-display text-lg font-semibold text-dark-500">{title}</h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-500 hover:bg-gold-50 transition-all duration-200"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 pt-4 pb-6 border-t border-gold-100 flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
