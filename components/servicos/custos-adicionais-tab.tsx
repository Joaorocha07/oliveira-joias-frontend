'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Tags } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { usePagination } from '@/hooks/use-pagination'
import {
  Card, Button, SearchInput, Select, Spinner, EmptyState, MetricCard, ConfirmDialog, Badge,
  PeriodFilter, getPeriodRange, Pagination, type PeriodPreset,
} from '@/components/ui'
import { ModalCustoAdicional } from '@/components/modals/modal-custo-adicional'
import { ModalGerenciarTiposCusto } from '@/components/modals/modal-gerenciar-tipos-custo'
import { listarCustos, excluirCusto } from '@/services/custos'
import { formatMoney, formatDate } from '@/utils'
import { correspondeBusca } from '@/utils/search'
import type { VendaCustoComRelacoes } from '@/types'

type FiltroVinculo = '' | 'venda' | 'servico'

// Aba "Custos adicionais" da tela de Serviços: cadastro e controle dos custos (mão de obra,
// gravação, frete...) vinculados a vendas e/ou ordens de serviço.
export function CustosAdicionaisTab() {
  const alert = useAlert()
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [custos, setCustos] = useState<VendaCustoComRelacoes[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroVinculo, setFiltroVinculo] = useState<FiltroVinculo>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<VendaCustoComRelacoes | null>(null)
  const [tiposOpen, setTiposOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<VendaCustoComRelacoes | null>(null)
  const [deletando, setDeletando] = useState(false)

  const loadCustos = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listarCustos({ dataInicio, dataFim })
    setCustos(data)
    setLoadError(error)
    setLoading(false)
  }, [dataInicio, dataFim])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadCustos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadCustos])

  const tiposNoPeriodo = useMemo(
    () => [...new Set(custos.map((c) => c.tipo_nome).filter((n): n is string => !!n))].sort(),
    [custos],
  )

  const filtered = useMemo(() => custos.filter((c) => {
    const matchSearch = correspondeBusca(search, [
      c.tipo_nome, c.descricao, c.venda?.numero, c.venda?.cliente?.nome,
      c.servico?.numero, c.servico?.tipo, c.servico?.cliente?.nome, c.valor,
    ])
    const matchTipo = !filtroTipo || c.tipo_nome === filtroTipo
    const matchVinculo = !filtroVinculo
      || (filtroVinculo === 'venda' && !!c.venda_id)
      || (filtroVinculo === 'servico' && !c.venda_id && !!c.servico_id)
    return matchSearch && matchTipo && matchVinculo
  }), [custos, search, filtroTipo, filtroVinculo])

  const resumo = useMemo(() => ({
    total: filtered.reduce((s, c) => s + c.valor, 0),
    vendas: filtered.filter((c) => c.venda_id).reduce((s, c) => s + c.valor, 0),
    servicos: filtered.filter((c) => !c.venda_id && c.servico_id).reduce((s, c) => s + c.valor, 0),
  }), [filtered])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  function openCreate() { setEditando(null); setModalOpen(true) }
  function openEdit(c: VendaCustoComRelacoes) { setEditando(c); setModalOpen(true) }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await excluirCusto(confirmDelete.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      setCustos((prev) => prev.filter((c) => c.id !== confirmDelete.id))
      alert.success('Custo Excluído!', 'O custo e a saída correspondente no caixa foram removidos.')
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  function vinculo(c: VendaCustoComRelacoes) {
    return (
      <div className="flex flex-col gap-0.5">
        {c.venda && (
          <span className="text-dark-600">
            Venda #{c.venda.numero}
            <span className="text-dark-400"> · {c.venda.cliente?.nome ?? 'Sem cliente'}</span>
          </span>
        )}
        {c.servico && (
          <span className={c.venda ? 'text-[11px] text-dark-400' : 'text-dark-600'}>
            Serviço #{c.servico.numero} · {c.servico.tipo}
          </span>
        )}
        {!c.venda && !c.servico && <span className="italic text-dark-300">Sem vínculo</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Total de custos" value={formatMoney(resumo.total)} changeType="down" accent />
        <MetricCard label="Em vendas" value={formatMoney(resumo.vendas)} change="descontado do lucro das vendas" />
        <MetricCard label="Só em serviços" value={formatMoney(resumo.servicos)} change="descontado do lucro dos serviços" />
        <MetricCard label="Lançamentos" value={String(filtered.length)} />
      </div>

      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-gold-100 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PeriodFilter
              dataInicio={dataInicio}
              dataFim={dataFim}
              activePreset={activePreset}
              onChange={({ inicio, fim, preset }) => {
                setDataInicio(inicio)
                setDataFim(fim)
                setActivePreset(preset)
              }}
            />
            <div className="flex gap-2">
              <Button variant="secondary" leftIcon={<Tags size={14} />} onClick={() => setTiposOpen(true)}>
                Tipos de custo
              </Button>
              <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
                Novo custo
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar por tipo, descrição, nº ou cliente..."
              className="flex-1"
            />
            <Select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} placeholder="Todos os tipos" className="w-full sm:w-44">
              {tiposNoPeriodo.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select
              value={filtroVinculo}
              onChange={(e) => setFiltroVinculo(e.target.value as FiltroVinculo)}
              placeholder="Todos os vínculos"
              className="w-full sm:w-44"
            >
              <option value="venda">Vendas</option>
              <option value="servico">Só serviços</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : loadError ? (
          <EmptyState title="Não foi possível carregar os custos" description={loadError} />
        ) : filtered.length === 0 ? (
          <EmptyState
            imageSrc="/images/software tester-bro.svg"
            title="Nenhum custo adicional"
            description={search || filtroTipo || filtroVinculo ? 'Tente ajustar os filtros.' : 'Nenhum custo lançado no período.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="divide-y divide-gold-50 sm:hidden">
              {paginated.map((c) => (
                <div key={c.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="gold">{c.tipo_nome ?? 'Custo'}</Badge>
                      <span className="text-xs text-dark-400">{formatDate(c.data_custo)}</span>
                    </div>
                    {c.descricao && <p className="mt-1 truncate text-dark-500">{c.descricao}</p>}
                    <div className="mt-1 text-xs">{vinculo(c)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-[#C75B5B]">−{formatMoney(c.valor)}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)} aria-label="Editar custo"><Pencil size={13} /></Button>
                      <Button variant="danger-ghost" size="icon" onClick={() => setConfirmDelete(c)} aria-label="Excluir custo"><Trash2 size={13} /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-dark-300">Data</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-dark-300">Tipo</th>
                    <th className="hidden px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-dark-300 md:table-cell">Descrição</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-dark-300">Vínculo</th>
                    <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wide text-dark-300">Valor</th>
                    <th className="w-20 px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {paginated.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-cream-50/40">
                      <td className="px-5 py-3 text-dark-400">{formatDate(c.data_custo)}</td>
                      <td className="px-5 py-3 font-medium text-dark-700">{c.tipo_nome ?? '—'}</td>
                      <td className="hidden max-w-[240px] px-5 py-3 text-dark-500 md:table-cell">
                        <span className="block truncate">{c.descricao || '—'}</span>
                      </td>
                      <td className="px-5 py-3">{vinculo(c)}</td>
                      <td className="px-5 py-3 text-right font-medium text-[#C75B5B]">−{formatMoney(c.valor)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(c)}
                            className="rounded-lg p-1.5 text-blue-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                            title="Editar custo"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(c)}
                            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Excluir custo"
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
      </Card>

      <ModalCustoAdicional
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null) }}
        onSuccess={() => { void loadCustos() }}
        custo={editando}
      />

      <ModalGerenciarTiposCusto open={tiposOpen} onClose={() => setTiposOpen(false)} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir custo adicional"
        description="O custo e a saída correspondente no caixa serão removidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deletando}
      />
    </div>
  )
}
