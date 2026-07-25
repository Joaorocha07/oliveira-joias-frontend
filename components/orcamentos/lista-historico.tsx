'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Eye, Pencil, Copy, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  Card, Badge, SearchInput, Spinner, EmptyState,
  ActionMenu, ConfirmDialog, PeriodFilter, Pagination, getPeriodRange,
} from '@/components/ui'
import type { PeriodPreset } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { formatMoney, formatDate } from '@/utils'
import { deleteOrcamento } from '@/services/orcamentos'
import type { Orcamento } from '@/types'

interface ListaHistoricoProps {
  refreshKey: number
  onEditar: (orcamento: Orcamento) => void
  onDuplicar: (orcamento: Orcamento) => void
  onVisualizar: (orcamento: Orcamento) => void
}

export function ListaHistorico({ refreshKey, onEditar, onDuplicar, onVisualizar }: ListaHistoricoProps) {
  const alert = useAlert()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const inicial = getPeriodRange('tudo')
  const [dataInicio, setDataInicio] = useState(inicial.inicio)
  const [dataFim, setDataFim] = useState(inicial.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('tudo')
  const [confirmDelete, setConfirmDelete] = useState<Orcamento | null>(null)
  const [deletando, setDeletando] = useState(false)

  const loadOrcamentos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      alert.error('Erro', 'Erro ao carregar orçamentos.')
    } else {
      setOrcamentos((data as Orcamento[]) ?? [])
    }
    setLoading(false)
  }, [dataInicio, dataFim])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadOrcamentos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadOrcamentos, refreshKey])

  const filtered = useMemo(() => {
    return orcamentos.filter((o) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        o.cliente_nome?.toLowerCase().includes(q) ||
        o.modelo_nome?.toLowerCase().includes(q) ||
        String(o.numero).includes(q)
      )
    })
  }, [orcamentos, search])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await deleteOrcamento(confirmDelete.id)
    if (error) {
      alert.error('Erro', 'Erro ao excluir orçamento.')
    } else {
      setOrcamentos((prev) => prev.filter((o) => o.id !== confirmDelete.id))
      alert.success('Orçamento Excluído!', 'O orçamento foi removido do histórico.')
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <Card padding="none">
      <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          activePreset={activePreset}
          onChange={({ inicio, fim, preset }) => { setDataInicio(inicio); setDataFim(fim); setActivePreset(preset) }}
        />
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por cliente, modelo ou nº..."
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          imageSrc="/images/software tester-bro.svg"
          title="Nenhum orçamento encontrado"
          description={search ? 'Tente ajustar a busca.' : 'Nenhum orçamento no período selecionado.'}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="sm:hidden divide-y divide-gold-50">
            {paginated.map((o) => (
              <div
                key={o.id}
                className="p-4 hover:bg-cream-50/30 transition-colors cursor-pointer active:bg-cream-100"
                onClick={() => onVisualizar(o)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        #{o.numero}
                      </span>
                      <p className="font-medium text-dark-700 text-sm truncate">
                        {o.cliente_nome || <span className="text-dark-300 italic">Sem nome</span>}
                      </p>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5 truncate">{o.modelo_nome || '—'}</p>
                    <p className="text-xs text-dark-300 mt-0.5">{formatDate(o.created_at)}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        { label: 'Visualizar', icon: <Eye size={14} />, onClick: () => onVisualizar(o) },
                        { label: 'Editar', icon: <Pencil size={14} />, onClick: () => onEditar(o) },
                        { label: 'Duplicar', icon: <Copy size={14} />, onClick: () => onDuplicar(o) },
                        { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(o), variant: 'danger' },
                      ]}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50 gap-2">
                  <Badge variant="gold">{o.num_parcelas}x sem juros</Badge>
                  <span className="font-medium text-dark-700">{formatMoney(o.valor_vista)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide w-14">#</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Modelo</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor à Vista</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Parcelado</th>
                  <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Data</th>
                  <th className="px-5 py-3 w-28" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {paginated.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-cream-50/40 transition-colors cursor-pointer"
                    onClick={() => onVisualizar(o)}
                  >
                    <td className="px-5 py-3 text-dark-400 font-mono text-xs">#{o.numero}</td>
                    <td className="px-5 py-3 font-medium text-dark-700 max-w-[160px]">
                      <span className="block truncate">
                        {o.cliente_nome || <span className="text-dark-300 italic font-normal">Sem nome</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-dark-600 max-w-[160px]">
                      <span className="block truncate">{o.modelo_nome || '—'}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-dark-700">{formatMoney(o.valor_vista)}</td>
                    <td className="px-5 py-3 text-dark-500">
                      {o.num_parcelas}x de {formatMoney(o.valor_parcela)}
                    </td>
                    <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(o.created_at)}</td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => onVisualizar(o)}
                          className="p-1.5 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-100 transition-colors"
                          title="Visualizar orçamento"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditar(o)}
                          className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar orçamento"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDuplicar(o)}
                          className="p-1.5 rounded-lg text-dark-300 hover:text-gold-600 hover:bg-gold-50 transition-colors"
                          title="Duplicar orçamento"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(o)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir orçamento"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir orçamento"
        description={`Deseja excluir o orçamento #${confirmDelete?.numero}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </Card>
  )
}
