'use client'

import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from 'react'
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

// ── Types ──────────────────────────────────────────────────────────────────
type AlertType = 'success' | 'error' | 'warning' | 'info'

interface AlertOptions {
  confirmText?: string
  cancelText?: string
  showCancel?: boolean
  onConfirm?: () => void | Promise<void>
  onCancel?: () => void
}

interface AlertState {
  type: AlertType
  title: string
  message: string
  opts: Required<AlertOptions>
}

interface AlertContextValue {
  success: (title: string, message: string, options?: AlertOptions) => void
  error:   (title: string, message: string, options?: AlertOptions) => void
  warning: (title: string, message: string, options?: AlertOptions) => void
  info:    (title: string, message: string, options?: AlertOptions) => void
  closeAlert: () => void
}

// ── Visual config per type ─────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    Icon:      CheckCircle2,
    iconColor: '#5B8C5B',
    iconBg:    'rgba(91,140,91,0.12)',
    iconBorder:'rgba(91,140,91,0.25)',
    titleColor:'#5B8C5B',
    btnBg:     '#5B8C5B',
    btnHover:  '#6BA06B',
    btnActive: '#4A754A',
  },
  error: {
    Icon:      XCircle,
    iconColor: '#C75B5B',
    iconBg:    'rgba(199,91,91,0.12)',
    iconBorder:'rgba(199,91,91,0.25)',
    titleColor:'#C75B5B',
    btnBg:     '#C75B5B',
    btnHover:  '#D46E6E',
    btnActive: '#B04A4A',
  },
  warning: {
    Icon:      AlertTriangle,
    iconColor: '#C9A84C',
    iconBg:    'rgba(201,168,76,0.12)',
    iconBorder:'rgba(201,168,76,0.25)',
    titleColor:'#C9A84C',
    btnBg:     '#C9A84C',
    btnHover:  '#D4B85A',
    btnActive: '#A68B3C',
  },
  info: {
    Icon:      Info,
    iconColor: '#5B8EB8',
    iconBg:    'rgba(91,142,184,0.12)',
    iconBorder:'rgba(91,142,184,0.25)',
    titleColor:'#5B8EB8',
    btnBg:     '#5B8EB8',
    btnHover:  '#6BA0CC',
    btnActive: '#4A78A0',
  },
} as const

// ── Context ────────────────────────────────────────────────────────────────
const AlertContext = createContext<AlertContextValue | null>(null)

function buildOpts(options?: AlertOptions): Required<AlertOptions> {
  return {
    confirmText: options?.confirmText ?? 'OK',
    cancelText:  options?.cancelText  ?? 'Cancelar',
    showCancel:  options?.showCancel  ?? false,
    onConfirm:   options?.onConfirm   ?? (() => undefined),
    onCancel:    options?.onCancel    ?? (() => undefined),
  }
}

// ── Provider ───────────────────────────────────────────────────────────────
export function AlertModalProvider({ children }: { children: ReactNode }) {
  const [alert, setAlert]     = useState<AlertState | null>(null)
  const [closing, setClosing] = useState(false)

  const closeAlert = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setAlert(null)
      setClosing(false)
    }, 200)
  }, [])

  const show = useCallback((type: AlertType, title: string, message: string, options?: AlertOptions) => {
    setAlert({ type, title, message, opts: buildOpts(options) })
    setClosing(false)
  }, [])

  const success = useCallback((t: string, m: string, o?: AlertOptions) => show('success', t, m, o), [show])
  const error   = useCallback((t: string, m: string, o?: AlertOptions) => show('error',   t, m, o), [show])
  const warning = useCallback((t: string, m: string, o?: AlertOptions) => show('warning', t, m, o), [show])
  const info    = useCallback((t: string, m: string, o?: AlertOptions) => show('info',    t, m, o), [show])

  /* Scroll lock */
  useEffect(() => {
    document.body.style.overflow = alert ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [alert])

  /* ESC */
  useEffect(() => {
    if (!alert) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAlert() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [alert, closeAlert])

  async function handleConfirm() {
    await alert?.opts.onConfirm()
    closeAlert()
  }

  function handleCancel() {
    alert?.opts.onCancel()
    closeAlert()
  }

  return (
    <AlertContext.Provider value={{ success, error, warning, info, closeAlert }}>
      {children}
      {alert && <AlertModal alert={alert} closing={closing} onConfirm={handleConfirm} onCancel={handleCancel} />}
    </AlertContext.Provider>
  )
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext)
  if (!ctx) throw new Error('useAlert must be used inside <AlertModalProvider>')
  return ctx
}

// ── AlertModal component ───────────────────────────────────────────────────
interface AlertModalProps {
  alert: AlertState
  closing: boolean
  onConfirm: () => void
  onCancel: () => void
}

function AlertModal({ alert, closing, onConfirm, onCancel }: AlertModalProps) {
  const cfg = TYPE_CONFIG[alert.type]
  const { Icon } = cfg

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Container */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-title"
        aria-describedby="alert-modal-message"
        className={cn(
          'relative w-full max-w-[420px] bg-white rounded-[20px] px-8 pt-10 pb-8 text-center',
          'border border-[rgba(232,213,163,0.3)] shadow-[0_24px_80px_rgba(26,21,16,0.18)]',
          closing ? 'animate-alertOut' : 'animate-alertIn',
        )}
      >
        {/* Botão fechar */}
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-lg text-[#9E9484] hover:text-[#2D2418] hover:bg-[#F5ECD0] transition-all duration-200"
          aria-label="Fechar"
        >
          <X size={16} />
        </button>

        {/* Ícone */}
        <div
          className="mx-auto mb-5 flex items-center justify-center w-[72px] h-[72px] rounded-full border-2"
          style={{
            backgroundColor: cfg.iconBg,
            borderColor: cfg.iconBorder,
            color: cfg.iconColor,
          }}
        >
          <Icon size={32} strokeWidth={1.75} />
        </div>

        {/* Título */}
        <h2
          id="alert-modal-title"
          className="text-xl font-semibold mb-2.5 font-display"
          style={{ color: cfg.titleColor }}
        >
          {alert.title}
        </h2>

        {/* Mensagem */}
        <p
          id="alert-modal-message"
          className="text-[15px] text-[#6B5E4E] leading-relaxed mb-7"
        >
          {alert.message}
        </p>

        {/* Ações */}
        <div className="flex gap-3 justify-center flex-wrap">
          {alert.opts.showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                'px-7 py-[11px] rounded-[10px] text-sm font-medium min-w-[110px]',
                'bg-transparent text-[#6B5E4E] border-[1.5px] border-[#D4C9B0]',
                'hover:bg-[#F5ECD0] hover:border-[#C9A84C] transition-all duration-200',
              )}
            >
              {alert.opts.cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'px-7 py-[11px] rounded-[10px] text-sm font-medium text-white min-w-[110px]',
              'shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition-all duration-200',
              'hover:-translate-y-px active:translate-y-0',
            )}
            style={{ backgroundColor: cfg.btnBg }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.btnHover }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.btnBg }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.btnActive }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = cfg.btnHover }}
          >
            {alert.opts.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
