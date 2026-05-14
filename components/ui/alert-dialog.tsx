'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './button'

const iconVariantClasses = {
  danger:  'bg-[rgba(199,91,91,0.12)] text-[#C75B5B]',
  warning: 'bg-[rgba(201,168,76,0.12)] text-gold-500',
  info:    'bg-[rgba(91,142,184,0.12)] text-[#5B8EB8]',
}

const iconVariantBorder = {
  danger:  'border-[rgba(199,91,91,0.2)]',
  warning: 'border-[rgba(201,168,76,0.2)]',
  info:    'border-[rgba(91,142,184,0.2)]',
}

interface AlertDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  icon?: ReactNode
  iconVariant?: 'danger' | 'warning' | 'info'
  title: string
  description: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
}

export function AlertDialog({
  open, onClose, onConfirm,
  icon, iconVariant = 'danger',
  title, description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading,
}: AlertDialogProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-desc"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]"
        onClick={!loading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative w-full max-w-[420px] bg-white rounded-[20px] border border-[rgba(232,213,163,0.3)] shadow-[0_24px_80px_rgba(26,21,16,0.18)]">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-500 hover:bg-gold-50 transition-all duration-200 disabled:opacity-40"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        {/* Conteúdo */}
        <div className="px-8 pt-10 pb-6 flex flex-col items-center text-center">
          {icon && (
            <div className={cn(
              'flex items-center justify-center w-[72px] h-[72px] rounded-full border-2 mb-5 flex-shrink-0',
              iconVariantClasses[iconVariant],
              iconVariantBorder[iconVariant],
            )}>
              {icon}
            </div>
          )}

          <h2
            id="alert-dialog-title"
            className={cn(
              'font-display text-xl font-semibold mb-2.5',
              iconVariant === 'danger'  && 'text-[#C75B5B]',
              iconVariant === 'warning' && 'text-dark-500',
              iconVariant === 'info'    && 'text-[#5B8EB8]',
            )}
          >
            {title}
          </h2>

          <p id="alert-dialog-desc" className="text-[15px] text-dark-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Ações */}
        <div className="px-8 pb-8 flex gap-3">
          <Button
            variant="ghost"
            className="flex-1 border border-gold-200 text-dark-400 hover:bg-gold-50 hover:border-gold-500"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
