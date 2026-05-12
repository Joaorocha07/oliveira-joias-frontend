'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './button'

const iconVariantClasses = {
  danger:  'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-600',
  info:    'bg-gold-100 text-gold-700',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-desc"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-dark-900/70 backdrop-blur-sm"
        onClick={!loading ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl border border-gold-100 shadow-2xl">
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors disabled:opacity-40"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        {/* Conteúdo */}
        <div className="px-6 pt-8 pb-5 flex flex-col items-center text-center">
          {icon && (
            <div className={cn(
              'flex items-center justify-center w-14 h-14 rounded-full mb-4 flex-shrink-0',
              iconVariantClasses[iconVariant],
            )}>
              {icon}
            </div>
          )}

          <h2
            id="alert-dialog-title"
            className="font-display text-xl font-medium text-dark-800 mb-2"
          >
            {title}
          </h2>

          <p id="alert-dialog-desc" className="text-sm text-dark-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
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
