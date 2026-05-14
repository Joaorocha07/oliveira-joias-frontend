'use client'

import {
  useState, useEffect, useRef, useCallback, useId, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from '@/components/ui'

export interface SelectOption {
  id: string
  label: string
  sublabel?: string
}

interface DropdownPos {
  top: number
  left: number
  width: number
}

interface SearchableSelectProps {
  value: string | null
  onChange: (id: string | null, option?: SelectOption) => boolean | void | Promise<boolean | void>
  displayValue?: string
  onSearch: (query: string) => Promise<SelectOption[]>
  label?: string
  error?: string
  placeholder?: string
  onCreateNew?: () => void
  createNewLabel?: string
  className?: string
  rightAddon?: ReactNode
}

export function SearchableSelect({
  value,
  onChange,
  displayValue,
  onSearch,
  label,
  error,
  placeholder = 'Buscar...',
  onCreateNew,
  createNewLabel = 'Cadastrar novo',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState(displayValue ?? '')
  const [pos, setPos] = useState<DropdownPos>({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dropdownId = useId()

  const updatePos = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownMaxH = 260
    const top =
      spaceBelow < dropdownMaxH && rect.top > dropdownMaxH
        ? rect.top - dropdownMaxH - 4
        : rect.bottom + 4
    setPos({ top, left: rect.left, width: rect.width })
  }, [])

  useEffect(() => {
    if (value) return
    const id = window.setTimeout(() => setSelectedLabel(''), 0)
    return () => window.clearTimeout(id)
  }, [value])

  useEffect(() => {
    if (displayValue === undefined) return
    const id = window.setTimeout(() => setSelectedLabel(displayValue), 0)
    return () => window.clearTimeout(id)
  }, [displayValue])

  useEffect(() => {
    if (!open) return
    updatePos()
    setTimeout(() => inputRef.current?.focus(), 10)
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const dropdown = document.getElementById(dropdownId)
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !dropdown?.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownId, open])

  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await onSearch(query)
        setOptions(results)
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, open, onSearch])

  async function handleSelect(opt: SelectOption) {
    const result = await onChange(opt.id, opt)
    if (result === false) return
    setSelectedLabel(opt.label)
    setOpen(false)
    setQuery('')
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setSelectedLabel('')
  }

  const optionLabel = value ? options.find((opt) => opt.id === value)?.label : ''
  const showLabel = selectedLabel || optionLabel || ''

  return (
    <div ref={containerRef} className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="label-base">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'input-base text-left flex items-center justify-between gap-2 cursor-pointer',
          open && 'border-gold-500 shadow-[0_0_0_3px_rgba(201,168,76,0.12)]',
          error && 'input-error',
        )}
      >
        <span className={cn('flex-1 truncate text-sm', !showLabel && 'text-[#9E9484]')}>
          {showLabel || placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {value && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 hover:bg-gold-50 rounded text-dark-300 hover:text-dark-500 transition-colors"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={cn(
              'text-gold-600 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>

      {error && <p className="text-xs text-[#C75B5B]">{error}</p>}

      {open &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            id={dropdownId}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="bg-white border border-gold-100 rounded-[10px] shadow-[0_8px_30px_rgba(26,21,16,0.12)] overflow-hidden"
          >
            {/* Busca */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gold-100">
              <Search size={14} className="text-gold-600 flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 text-sm outline-none text-dark-500 placeholder:text-dark-300 bg-transparent"
              />
              {loading && <Spinner size={13} />}
            </div>

            {/* Opções */}
            <div className="max-h-48 overflow-y-auto">
              {!loading && options.length === 0 && (
                <p className="text-sm text-dark-300 text-center py-4 px-3">
                  {query ? 'Nenhum resultado encontrado' : 'Digite para buscar'}
                </p>
              )}
              {options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn(
                    'w-full text-left px-3.5 py-2.5 text-sm transition-colors',
                    opt.id === value
                      ? 'bg-gold-50 text-gold-500 font-medium'
                      : 'text-dark-500 hover:bg-gold-50',
                  )}
                  onClick={() => handleSelect(opt)}
                >
                  <div className="font-medium">{opt.label}</div>
                  {opt.sublabel && (
                    <div className="text-xs text-dark-300 mt-0.5">{opt.sublabel}</div>
                  )}
                </button>
              ))}
            </div>

            {/* Criar novo */}
            {onCreateNew && (
              <div className="border-t border-gold-100">
                <button
                  type="button"
                  onClick={() => { onCreateNew(); setOpen(false) }}
                  className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm text-gold-500 hover:bg-gold-50 transition-colors font-medium"
                >
                  <Plus size={14} />
                  {createNewLabel}
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
