import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (p: number) => void
  from: number
  to: number
  total: number
  className?: string
}

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total]
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  }
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export function Pagination({ page, totalPages, onPageChange, from, to, total, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const pages = getPageNumbers(page, totalPages)

  return (
    <div className={cn(
      'flex items-center justify-between gap-3 px-5 py-3 border-t border-[#F0EBE0] flex-wrap',
      className,
    )}>
      {/* Contagem */}
      <p className="text-xs text-[#9E9484] whitespace-nowrap">
        {from}–{to} de <span className="font-medium text-[#6B5E4E]">{total}</span> itens
      </p>

      {/* Controles */}
      <div className="flex items-center gap-1">
        {/* Anterior */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#F0EBE0] text-[#6B5E4E] hover:bg-[#FAF7F0] hover:border-[#E8D5A3] disabled:opacity-35 disabled:cursor-not-allowed transition-all"
          aria-label="Página anterior"
        >
          <ChevronLeft size={15} />
        </button>

        {/* Números — ocultos em telas muito pequenas */}
        <div className="hidden sm:flex items-center gap-1">
          {pages.map((p, i) =>
            p === '...' ? (
              <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-[#9E9484] select-none">
                ···
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p as number)}
                className={cn(
                  'w-8 h-8 rounded-lg text-xs font-medium transition-all',
                  p === page
                    ? 'bg-[#C9A84C] text-white border border-[#C9A84C] shadow-sm'
                    : 'text-[#6B5E4E] border border-transparent hover:bg-[#FAF7F0] hover:border-[#E8D5A3]',
                )}
                aria-current={p === page ? 'page' : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>

        {/* Indicador simples no mobile */}
        <span className="sm:hidden text-xs text-[#6B5E4E] px-2 font-medium">
          {page} / {totalPages}
        </span>

        {/* Próxima */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#F0EBE0] text-[#6B5E4E] hover:bg-[#FAF7F0] hover:border-[#E8D5A3] disabled:opacity-35 disabled:cursor-not-allowed transition-all"
          aria-label="Próxima página"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
