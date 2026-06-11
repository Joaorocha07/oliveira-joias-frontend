'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, SearchInput, Select, Spinner, EmptyState,
  PeriodFilter, getPeriodRange, type PeriodPreset, Pagination,
} from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { ModalPagarParcela } from '@/components/modals/modal-pagar-parcela'
import { ModalEditarCrediario } from '@/components/modals/modal-editar-crediario'
import { DrawerDetalheCrediario, type CrediarioRow } from '@/components/crediario/drawer-detalhe-crediario'
import {
  formatMoney, formatDate, crediarioStatusVariant, CREDIARIO_STATUS_LABEL, today, parcelaVencida,
} from '@/utils'
import type { CrediarioParcela, CrediarioStatus } from '@/types'

// ── Computed helpers ──────────────────────────────────────────────

function computeSaldo(c: CrediarioRow): number {
  const parcelas = c.parcelas ?? []
  const totalPago = parcelas.filter((p) => p.status === 'pago').reduce((sum, p) => sum + p.valor_pago, 0)
  return Math.max(0, c.total - c.entrada - totalPago)
}

function computeStatus(c: CrediarioRow): CrediarioStatus {
  if (c.status === 'cancelado') return 'cancelado'
  const saldoAtual = computeSaldo(c)
  if (saldoAtual <= 0) return 'quitado'
  const atrasada = (c.parcelas ?? []).some(
    (p) => p.status !== 'pago' && p.status !== 'cancelado' && parcelaVencida(p.data_vencimento),
  )
  return atrasada ? 'vencido' : 'em_dia'
}

function proxVencimento(parcelas: CrediarioParcela[] | null | undefined): CrediarioParcela | null {
  const pending = (parcelas ?? []).filter((p) => p.status !== 'pago' && p.status !== 'cancelado')
  if (pending.length === 0) return null
  return pending.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0]
}

function ProxVencDisplay({ parcela }: { parcela: CrediarioParcela | null }) {
  if (!parcela) return <span className="text-dark-300">—</span>
  const todayStr = today()
  const dvStr = parcela.data_vencimento.slice(0, 10)
  if (dvStr < todayStr) {
    return <span className="text-red-600 text-xs font-medium">Venceu {formatDate(parcela.data_vencimento)}</span>
  }
  if (dvStr === todayStr) {
    return <span className="text-orange-500 text-xs font-medium">Vence hoje</span>
  }
  return <span className="text-green-600 text-xs">{formatDate(parcela.data_vencimento)}</span>
}

function ParcelasBadge({ c }: { c: CrediarioRow }) {
  const parcelas = c.parcelas ?? []
  const total = parcelas.length
  const pagas = parcelas.filter((p) => p.status === 'pago').length
  const ratio = total > 0 ? pagas / total : 0
  const colorClass =
    ratio >= 0.5
      ? 'bg-green-100 text-green-700'
      : pagas > 0
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {pagas}/{total}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function CrediarioPage() {
  const alert = useAlert()
  const [crediarios, setCrediarios] = useState<CrediarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<CrediarioStatus | ''>('')
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')

  const [selectedCrediario, setSelectedCrediario] = useState<CrediarioRow | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editandoCrediario, setEditandoCrediario] = useState<CrediarioRow | null>(null)
  const [parcelaSelecionada, setParcelaSelecionada] = useState<CrediarioParcela | null>(null)
  const [modalPagarOpen, setModalPagarOpen] = useState(false)

  const loadCrediarios = useCallback(async () => {
    const { data, error } = await supabase
      .from('crediario')
      .select('*, cliente:clientes(nome, telefone), parcelas:crediario_parcelas(*), venda:vendas(numero, data_venda, forma_pagamento)')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false })

    if (error) {
      alert.error('Erro', 'Erro ao carregar crediários.')
      setLoading(false)
      return null
    }
    const rows = (data as CrediarioRow[]) ?? []
    setCrediarios(rows)
    setLoading(false)
    return rows
  }, [alert, dataFim, dataInicio])

  useEffect(() => {
    const id = window.setTimeout(() => void loadCrediarios(), 0)
    return () => window.clearTimeout(id)
  }, [loadCrediarios])

  async function refreshAndSync() {
    const rows = await loadCrediarios()
    if (rows && selectedCrediario) {
      const updated = rows.find((c) => c.id === selectedCrediario.id)
      if (updated) setSelectedCrediario(updated)
    }
  }

  const filtered = useMemo(() => {
    return crediarios.filter((c) => {
      const matchSearch = !search || c.cliente?.nome?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = !filtroStatus || computeStatus(c) === filtroStatus
      return matchSearch && matchStatus
    })
  }, [crediarios, search, filtroStatus])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  function openDrawer(c: CrediarioRow) {
    setSelectedCrediario(c)
    setDrawerOpen(true)
  }

  function handleReceberParcela(parcela: CrediarioParcela) {
    setParcelaSelecionada(parcela)
    setModalPagarOpen(true)
  }

  function handleEditarCrediario() {
    setEditandoCrediario(selectedCrediario)
  }

  return (
    <div>
      <PageHeader
        title="Crediário"
        subtitle="Controle de parcelas e financiamento"
      />

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
          <PeriodFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            activePreset={activePreset}
            onChange={({ inicio, fim, preset }) => {
              setLoading(true)
              setDataInicio(inicio)
              setDataFim(fim)
              setActivePreset(preset)
            }}
          />
          <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente..."
            className="flex-1"
          />
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as CrediarioStatus | '')}
            placeholder="Todos os status"
            className="w-full sm:w-44"
          >
            {(Object.keys(CREDIARIO_STATUS_LABEL) as CrediarioStatus[]).map((s) => (
              <option key={s} value={s}>{CREDIARIO_STATUS_LABEL[s]}</option>
            ))}
          </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            imageSrc="/images/Ecommerce checkout laptop-cuate.svg"
            title="Nenhum crediário encontrado"
            description={search || filtroStatus ? 'Tente ajustar os filtros.' : 'Nenhum crediário registrado.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {paginated.map((c) => {
                const computedStatus = computeStatus(c)
                const prox = proxVencimento(c.parcelas)
                return (
                  <div
                    key={c.id}
                    className="p-4 hover:bg-cream-50/30 transition-colors cursor-pointer active:bg-cream-100"
                    onClick={() => openDrawer(c)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-dark-700 text-sm truncate">
                        {c.cliente?.nome || <span className="text-dark-300 italic">Sem cliente</span>}
                      </p>
                      <Badge variant={crediarioStatusVariant(computedStatus)} className="flex-shrink-0">
                        {CREDIARIO_STATUS_LABEL[computedStatus]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-xs text-dark-400">Saldo</span>
                      <span className="font-medium text-dark-700">{formatMoney(computeSaldo(c))}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gold-50">
                      <ParcelasBadge c={c} />
                      <ProxVencDisplay parcela={prox} />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Total</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Entrada</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Saldo</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Parcelas</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Próx. Venc.</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {paginated.map((c) => {
                    const computedStatus = computeStatus(c)
                    const prox = proxVencimento(c.parcelas)
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-cream-50/40 transition-colors cursor-pointer"
                        onClick={() => openDrawer(c)}
                      >
                        <td className="px-5 py-3 font-medium text-dark-700 max-w-[180px]">
                          <span className="block truncate">
                            {c.cliente?.nome || <span className="text-dark-300 italic font-normal">Sem cliente</span>}
                          </span>
                        </td>
                        <td className="hidden lg:table-cell px-5 py-3 text-dark-400">{formatMoney(c.total)}</td>
                        <td className="hidden lg:table-cell px-5 py-3 text-dark-400">{formatMoney(c.entrada)}</td>
                        <td className="px-5 py-3 font-medium text-dark-700">{formatMoney(computeSaldo(c))}</td>
                        <td className="px-5 py-3">
                          <ParcelasBadge c={c} />
                        </td>
                        <td className="hidden md:table-cell px-5 py-3">
                          <ProxVencDisplay parcela={prox} />
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={crediarioStatusVariant(computedStatus)}>
                            {CREDIARIO_STATUS_LABEL[computedStatus]}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-dark-300">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
          </>
        )}
      </Card>

      <DrawerDetalheCrediario
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        crediario={selectedCrediario}
        onEditarCrediario={handleEditarCrediario}
        onReceberParcela={handleReceberParcela}
      />

      <ModalEditarCrediario
        open={!!editandoCrediario}
        onClose={() => setEditandoCrediario(null)}
        onSuccess={refreshAndSync}
        crediario={editandoCrediario}
      />

      <ModalPagarParcela
        open={modalPagarOpen}
        onClose={() => { setModalPagarOpen(false); setParcelaSelecionada(null) }}
        onSuccess={refreshAndSync}
        parcela={parcelaSelecionada}
      />
    </div>
  )
}
