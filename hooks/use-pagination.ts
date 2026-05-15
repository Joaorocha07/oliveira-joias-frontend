import { useState, useEffect, useMemo } from 'react'

export const PAGE_SIZE = 10

export interface PaginationMeta {
  page: number
  setPage: (p: number) => void
  totalPages: number
  total: number
  from: number
  to: number
}

export interface UsePaginationResult<T> extends PaginationMeta {
  paginated: T[]
}

export function usePagination<T>(items: T[], pageSize = PAGE_SIZE): UsePaginationResult<T> {
  const [page, setPage] = useState(1)

  // Sempre volta para a página 1 quando a lista muda (filtro/busca)
  useEffect(() => { setPage(1) }, [items])

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize))
  const safePage = Math.min(page, totalPages)

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  return {
    page: safePage,
    setPage,
    totalPages,
    paginated,
    total: items.length,
    from: items.length === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, items.length),
  }
}
