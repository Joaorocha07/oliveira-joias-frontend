'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface ActionMenuItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface ActionMenuProps {
  items: ActionMenuItem[]
  className?: string
}

export function ActionMenu({ items, className }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation()
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return

    function handleOutside(e: MouseEvent) {
      const target = e.target as Node
      const inTrigger = triggerRef.current?.contains(target)
      const inDropdown = dropdownRef.current?.contains(target)
      if (!inTrigger && !inDropdown) setOpen(false)
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }

    // Fecha ao rolar para evitar dropdown desposicionado
    function handleScroll() { setOpen(false) }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [open])

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors"
        aria-label="Abrir ações"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <MoreVertical size={15} />
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[156px] bg-white rounded-xl border border-gold-100 shadow-lg py-1 overflow-hidden"
          style={{ top: pos.top, right: pos.right }}
        >
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); item.onClick() }}
              className={cn(
                'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors',
                item.variant === 'danger'
                  ? 'text-red-600 hover:bg-red-50'
                  : 'text-dark-600 hover:bg-cream-100',
              )}
            >
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
