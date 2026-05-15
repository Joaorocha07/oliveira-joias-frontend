'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { X, ShoppingBag, Wrench, BarChart3, Star, Phone, Mail, CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Spinner, Pagination } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import {
  formatDate, formatMoney, formatCPF, formatPhone,
  vendaStatusVariant, servicoStatusVariant,
  VENDA_STATUS_LABEL, SERVICO_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
} from '@/utils'
import type { Cliente, Venda, VendaItem, Servico } from '@/types'

type Tab = 'compras' | 'servicos' | 'resumo'
type VendaComItens = Venda & { itens?: VendaItem[] }

interface Props {
  open: boolean
  onClose: () => void
  cliente: Cliente | null
}

export function ModalHistoricoCliente({ open, onClose, cliente }: Props) {
  const [tab, setTab] = useState<Tab>('compras')
  const [vendas, setVendas] = useState<VendaComItens[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(false)
  const clienteId = cliente?.id

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => {
    if (!open || !clienteId) return
    let cancelled = false

    void (async () => {
      setTab('compras')
      setLoading(true)
      setVendas([])
      setServicos([])

      const [vendasRes, servicosRes] = await Promise.all([
        supabase
          .from('vendas')
          .select('*, itens:venda_itens(*)')
          .eq('cliente_id', clienteId)
          .order('data_venda', { ascending: false }),
        supabase
          .from('servicos')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('data_entrada', { ascending: false }),
      ])
      if (cancelled) return
      setVendas((vendasRes.data ?? []) as VendaComItens[])
      setServicos(servicosRes.data ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, clienteId])

  if (!open || !cliente) return null

  const totalCompras = vendas.reduce((s, v) => s + v.total, 0)
  const totalServicos = servicos.reduce((s, sv) => s + sv.valor, 0)
  const ticketMedio = vendas.length > 0 ? totalCompras / vendas.length : 0
  const ultimaCompra = vendas[0]?.data_venda ?? null
  const anoCliente = new Date(cliente.created_at).getFullYear()
  const iniciais = cliente.nome.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Histórico de ${cliente.nome}`}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.60)] backdrop-blur-[8px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Painel */}
      <div className="relative w-full max-w-[calc(100vw-1rem)] sm:max-w-[900px] bg-white rounded-xl sm:rounded-2xl flex min-h-0 flex-col max-h-[calc(100dvh-1rem)] sm:max-h-[92vh] border border-[rgba(232,213,163,0.35)] shadow-[0_24px_80px_rgba(26,21,16,0.18)]">

        {/* Banner com dados do cliente */}
        <div className="flex-shrink-0 rounded-t-xl sm:rounded-t-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-[#1A1510] to-[#2D2418] px-3 sm:px-6 py-3.5 sm:py-5 relative">
            <div
              className="absolute inset-0 opacity-[0.06] pointer-events-none"
              style={{ backgroundImage: 'radial-gradient(circle at 80% 50%, #C9A84C 0%, transparent 60%)' }}
            />

            <div className="relative flex items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Avatar */}
                <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full border-2 border-[#C9A84C]/40 bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#C9A84C] text-xs sm:text-sm font-semibold font-display">{iniciais}</span>
                </div>

                <div className="min-w-0">
                  <h3 className="font-display text-base sm:text-lg font-semibold text-white truncate leading-tight">
                    {cliente.nome}
                  </h3>
                  {/* Contatos — empilham em telas muito pequenas */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {cliente.cpf && (
                      <span className="flex min-w-0 items-center gap-1 text-[11px] text-[#C9A84C]/80 font-mono">
                        <CreditCard size={9} />
                        {formatCPF(cliente.cpf)}
                      </span>
                    )}
                    {cliente.telefone && (
                      <span className="flex min-w-0 items-center gap-1 text-[11px] text-white/60">
                        <Phone size={9} />
                        {formatPhone(cliente.telefone)}
                      </span>
                    )}
                    {cliente.email && (
                      <span className="hidden min-[420px]:flex items-center gap-1 text-[11px] text-white/60 truncate max-w-[180px]">
                        <Mail size={9} />
                        {cliente.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all duration-200"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Abas */}
          <div className="grid grid-cols-3 border-b border-[#F0EBE0] bg-white px-1 sm:flex sm:px-6 sm:overflow-x-auto">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex min-w-0 items-center justify-center gap-1 px-1.5 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-all duration-150 ${
                  tab === key
                    ? 'border-[#C9A84C] text-[#A68B3C]'
                    : 'border-transparent text-[#6B5E4E] hover:text-[#2D2418] hover:border-[#D4C9B0]'
                }`}
              >
                <Icon size={13} className="shrink-0" />
                <span className="min-w-0 truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Corpo com scroll */}
        <div className="min-h-0 overflow-y-auto flex-1 px-2.5 sm:px-6 py-3 sm:py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <Spinner size={28} />
              <p className="text-sm text-[#9E9484]">Carregando histórico...</p>
            </div>
          ) : (
            <>
              {tab === 'compras' && <TabCompras vendas={vendas} />}
              {tab === 'servicos' && <TabServicos servicos={servicos} />}
              {tab === 'resumo' && (
                <TabResumo
                  totalCompras={totalCompras}
                  totalServicos={totalServicos}
                  ticketMedio={ticketMedio}
                  ultimaCompra={ultimaCompra}
                  anoCliente={anoCliente}
                  totalComprasCount={vendas.length}
                  totalServicosCount={servicos.length}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── CONFIG ───────────────────────────────────────────────────────

const TABS = [
  { key: 'compras' as const,  label: 'Compras',      Icon: ShoppingBag },
  { key: 'servicos' as const, label: 'Serviços',     Icon: Wrench },
  { key: 'resumo' as const,   label: 'Resumo Geral', Icon: BarChart3 },
]

// ── TAB COMPRAS ──────────────────────────────────────────────────

function groupByDate(vendas: VendaComItens[]) {
  const groups = new Map<string, VendaComItens[]>()
  for (const v of vendas) {
    const key = v.data_venda.substring(0, 10)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(v)
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a))
}

function TabCompras({ vendas }: { vendas: VendaComItens[] }) {
  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(vendas)

  if (vendas.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Image
          src="/images/Shopping-bro.svg"
          alt="Nenhuma compra"
          width={140}
          height={140}
          className="opacity-80 mb-3"
        />
        <p className="text-sm font-medium text-[#6B5E4E]">Nenhuma compra registrada</p>
        <p className="text-xs text-[#9E9484] mt-1">Este cliente ainda não realizou compras.</p>
      </div>
    )
  }

  const groups = groupByDate(paginated)

  return (
    <div className="space-y-5">
      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-3 mb-2.5">
            <p className="text-xs font-semibold text-[#9E9484] uppercase tracking-wider whitespace-nowrap">
              {formatDate(date)}
            </p>
            <div className="flex-1 h-px bg-[#F0EBE0]" />
          </div>

          <div className="space-y-2">
            {items.map((venda) => (
              <div key={venda.id} className="border border-[#F0EBE0] rounded-xl overflow-hidden">
                {/* Header da venda — empilha no mobile */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 px-3 sm:px-4 py-2.5 bg-[#FAF7F0]">
                  <div className="flex min-w-0 items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-[#9E9484]">#{venda.numero}</span>
                    <span className="text-xs text-[#6B5E4E] truncate">
                      {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento]}
                    </span>
                    <Badge variant={vendaStatusVariant(venda.status)}>
                      {VENDA_STATUS_LABEL[venda.status]}
                    </Badge>
                  </div>
                  <span className="text-sm font-semibold text-[#2D2418] text-right">
                    {formatMoney(venda.total)}
                  </span>
                </div>

                {/* Itens */}
                {(venda.itens ?? []).length > 0 && (
                  <div className="divide-y divide-[#F5ECD0]/80">
                    {(venda.itens ?? []).map((item) => (
                      <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 px-3 sm:px-4 py-2">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-sm text-[#2D2418] leading-snug line-clamp-2">{item.nome_produto}</span>
                          {item.quantidade > 1 && (
                            <span className="text-xs text-[#9E9484] flex-shrink-0">×{item.quantidade}</span>
                          )}
                        </div>
                        <span className="text-sm text-[#6B5E4E] text-right whitespace-nowrap">
                          {formatMoney(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} className="px-0 pb-0" />
    </div>
  )
}

// ── TAB SERVIÇOS ─────────────────────────────────────────────────

function TabServicos({ servicos }: { servicos: Servico[] }) {
  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(servicos)

  if (servicos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Image
          src="/images/No data-cuate.svg"
          alt="Nenhum serviço"
          width={140}
          height={140}
          className="opacity-80 mb-3"
        />
        <p className="text-sm font-medium text-[#6B5E4E]">Nenhum serviço registrado</p>
        <p className="text-xs text-[#9E9484] mt-1">Este cliente ainda não utilizou serviços.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {paginated.map((servico) => (
        <div key={servico.id} className="border border-[#F0EBE0] rounded-xl px-3 sm:px-4 py-3 hover:border-[#E8D5A3] hover:bg-[#FAF7F0]/60 transition-colors">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-[#9E9484]">#{servico.numero}</span>
                <span className="text-[#D4C9B0] text-xs select-none">·</span>
                <span className="text-xs text-[#6B5E4E]">{formatDate(servico.data_entrada)}</span>
              </div>
              <p className="text-sm font-semibold text-[#2D2418]">{servico.tipo}</p>
              <p className="text-xs text-[#6B5E4E] mt-0.5 line-clamp-2 leading-relaxed">
                {servico.descricao}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <Badge variant={servicoStatusVariant(servico.status)}>
                {SERVICO_STATUS_LABEL[servico.status]}
              </Badge>
              <span className="text-sm font-semibold text-[#2D2418]">{formatMoney(servico.valor)}</span>
            </div>
          </div>
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} className="px-0 pb-0" />
    </div>
  )
}

// ── TAB RESUMO ───────────────────────────────────────────────────

interface TabResumoProps {
  totalCompras: number
  totalServicos: number
  ticketMedio: number
  ultimaCompra: string | null
  anoCliente: number
  totalComprasCount: number
  totalServicosCount: number
}

function TabResumo({
  totalCompras, totalServicos, ticketMedio, ultimaCompra,
  anoCliente, totalComprasCount, totalServicosCount,
}: TabResumoProps) {
  const totalGeral = totalCompras + totalServicos
  const semMovimentacao = totalComprasCount === 0 && totalServicosCount === 0

  return (
    <div className="space-y-4">
      {semMovimentacao ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <Image
            src="/images/Analytics-rafiki.svg"
            alt="Sem movimentações"
            width={160}
            height={160}
            className="opacity-75 mb-3"
          />
          <p className="text-sm font-medium text-[#6B5E4E]">Nenhuma movimentação encontrada</p>
          <p className="text-xs text-[#9E9484] mt-1">
            Cliente desde {anoCliente} · Sem compras ou serviços registrados.
          </p>
        </div>
      ) : (
        <>
          {/* Métricas — 2 colunas no mobile, 4 no desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {[
              { label: 'Total em Compras',  value: formatMoney(totalCompras),  highlight: false },
              { label: 'Total em Serviços', value: formatMoney(totalServicos), highlight: false },
              { label: 'Ticket Médio',      value: formatMoney(ticketMedio),   highlight: false },
              { label: 'Gasto Total',       value: formatMoney(totalGeral),    highlight: true  },
            ].map(({ label, value, highlight }) => (
              <div
                key={label}
                className={`rounded-xl p-3 sm:p-4 ${
                  highlight
                    ? 'bg-gradient-to-br from-[#F5ECD0] to-[#F0E8C8] border border-[#E8D5A3]'
                    : 'bg-[#FAF7F0] border border-[#F0EBE0]'
                }`}
              >
                <p className="text-[11px] sm:text-xs text-[#9E9484] mb-1 leading-tight">{label}</p>
                <p className={`text-sm sm:text-base font-semibold font-display leading-tight ${
                  highlight ? 'text-[#A68B3C]' : 'text-[#2D2418]'
                }`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Bloco de fidelidade */}
          <div className="rounded-xl border border-[#E8D5A3] overflow-hidden">
            <div className="bg-gradient-to-r from-[#1A1510] to-[#2D2418] px-4 py-3 flex items-center gap-2">
              <Star size={13} className="text-[#C9A84C]" fill="currentColor" />
              <span className="text-sm font-semibold text-white">Status de Fidelidade</span>
            </div>
            <div className="bg-[#F5ECD0]/30 px-4 py-4 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              {/* Imagem decorativa — oculta no mobile para economizar espaço */}
              <Image
                src="/images/Success factors-amico.svg"
                alt=""
                width={80}
                height={80}
                className="flex-shrink-0 opacity-90 hidden sm:block"
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#2D2418] leading-relaxed">
                  Cliente desde <strong>{anoCliente}</strong>
                  {totalComprasCount > 0 && (
                    <> · <strong>{totalComprasCount}</strong> compra{totalComprasCount !== 1 ? 's' : ''}</>
                  )}
                  {totalServicosCount > 0 && (
                    <> · <strong>{totalServicosCount}</strong> serviço{totalServicosCount !== 1 ? 's' : ''}</>
                  )}
                </p>
                {ultimaCompra && (
                  <p className="text-xs text-[#6B5E4E] mt-1.5">
                    Última compra: <span className="font-medium">{formatDate(ultimaCompra)}</span>
                  </p>
                )}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {totalComprasCount >= 10 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#C9A84C]/15 text-[#A68B3C] border border-[#C9A84C]/30 rounded-full px-2.5 py-0.5 font-medium">
                      <Star size={10} fill="currentColor" /> Cliente Fiel
                    </span>
                  )}
                  {totalComprasCount >= 1 && totalComprasCount < 10 && (
                    <span className="inline-flex items-center gap-1 text-xs bg-[#5B8EB8]/10 text-[#5B8EB8] border border-[#5B8EB8]/20 rounded-full px-2.5 py-0.5 font-medium">
                      Cliente Recorrente
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
