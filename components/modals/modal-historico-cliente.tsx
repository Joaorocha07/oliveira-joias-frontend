'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import {
  X, ShoppingBag, Wrench, BarChart3, Star, Phone, Mail, CreditCard, UserRound,
  History, FileText, Repeat, Send, CalendarClock, MessageCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Spinner, Pagination, Button, Textarea } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { listarTimeline, criarNotaTimeline, updateStatusQualificacao } from '@/services/clientes'
import { listarArquivos, uploadArquivo, excluirArquivo, getArquivoUrl } from '@/services/arquivos'
import { ModalAgendarFollowUp } from '@/components/modals/modal-agendar-followup'
import { ModalWhatsApp } from '@/components/modals/modal-whatsapp'
import {
  formatDate, formatDateTime, formatMoney, formatCPF, formatPhone,
  vendaStatusVariant, servicoStatusVariant, statusFunilVariant,
  VENDA_STATUS_LABEL, SERVICO_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
  STATUS_FUNIL_LABEL, PRODUTO_INTERESSE_LABEL, STATUS_QUALIFICACAO_LABEL, STATUS_QUALIFICACAO_COR,
} from '@/utils'
import type {
  Cliente, Venda, VendaItem, Servico, ProfileResumo, ClienteTimelineEvento, StatusQualificacao,
  ClienteArquivo, ClienteArquivoTipo,
} from '@/types'

const STATUS_QUALIFICACAO_OPTS: StatusQualificacao[] = [
  'novo_lead', 'em_atendimento', 'fazendo_orcamento', 'interessado',
  'aguardando_resposta', 'follow_up_agendado', 'venda_concluida',
  'lead_perdido', 'nao_respondeu',
]

type Tab = 'compras' | 'servicos' | 'resumo' | 'timeline'
type VendaComItens = Omit<Venda, 'itens' | 'vendedor'> & {
  itens?: VendaItem[]
  vendedor?: ProfileResumo | ProfileResumo[] | null
}

interface Props {
  open: boolean
  onClose: () => void
  cliente: Cliente | null
}

export function ModalHistoricoCliente({ open, onClose, cliente }: Props) {
  const { user } = useAuth()
  const alert = useAlert()
  const [tab, setTab] = useState<Tab>('compras')
  const [vendas, setVendas] = useState<VendaComItens[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [timeline, setTimeline] = useState<ClienteTimelineEvento[]>([])
  const [loading, setLoading] = useState(false)
  const [nota, setNota] = useState('')
  const [enviandoNota, setEnviandoNota] = useState(false)
  const [agendarOpen, setAgendarOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [statusQualif, setStatusQualif] = useState<StatusQualificacao>('novo_lead')
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [arquivos, setArquivos] = useState<ClienteArquivo[]>([])
  const [enviandoArquivo, setEnviandoArquivo] = useState<ClienteArquivoTipo | null>(null)
  const clienteId = cliente?.id

  async function recarregarTimeline() {
    if (!clienteId) return
    const { data } = await listarTimeline(clienteId)
    setTimeline(data ?? [])
  }

  async function recarregarArquivos() {
    if (!clienteId) return
    const { data } = await listarArquivos(clienteId)
    setArquivos(data ?? [])
  }

  async function handleUploadArquivo(file: File | undefined, tipo: ClienteArquivoTipo) {
    if (!file || !clienteId || !user) return
    setEnviandoArquivo(tipo)
    const { error } = await uploadArquivo(clienteId, file, tipo, user.id)
    if (error) alert.error('Erro', error)
    else await recarregarArquivos()
    setEnviandoArquivo(null)
  }

  async function handleExcluirArquivo(arquivo: ClienteArquivo) {
    const { error } = await excluirArquivo(arquivo)
    if (error) alert.error('Erro', error)
    else setArquivos((prev) => prev.filter((a) => a.id !== arquivo.id))
  }

  async function handleChangeStatusQualificacao(novo: StatusQualificacao) {
    if (!clienteId || !user) return
    const anterior = statusQualif
    setStatusQualif(novo)
    setSalvandoStatus(true)
    const { error } = await updateStatusQualificacao(clienteId, novo, user.id)
    if (error) {
      alert.error('Erro', error)
      setStatusQualif(anterior)
    } else {
      await recarregarTimeline()
    }
    setSalvandoStatus(false)
  }

  async function handleEnviarNota() {
    if (!clienteId || !user || !nota.trim()) return
    setEnviandoNota(true)
    const { error } = await criarNotaTimeline(clienteId, nota.trim(), user.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      setNota('')
      await recarregarTimeline()
    }
    setEnviandoNota(false)
  }

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
      setTimeline([])
      setArquivos([])
      if (cliente) setStatusQualif(cliente.status_qualificacao)

      const [vendasRes, servicosRes, timelineRes, arquivosRes] = await Promise.all([
        supabase
          .from('vendas')
          .select('*, vendedor:profiles(nome), itens:venda_itens(*)')
          .eq('cliente_id', clienteId)
          .order('data_venda', { ascending: false }),
        supabase
          .from('servicos')
          .select('*')
          .eq('cliente_id', clienteId)
          .order('data_entrada', { ascending: false }),
        listarTimeline(clienteId),
        listarArquivos(clienteId),
      ])
      if (cancelled) return
      setVendas((vendasRes.data ?? []) as VendaComItens[])
      setServicos(servicosRes.data ?? [])
      setTimeline(timelineRes.data ?? [])
      setArquivos(arquivosRes.data ?? [])
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
    <>
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
          <div className="grid grid-cols-4 border-b border-[#F0EBE0] bg-white px-1 sm:flex sm:px-6 sm:overflow-x-auto">
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
              {tab === 'timeline' && (
                <TabTimeline
                  cliente={cliente}
                  eventos={timeline}
                  nota={nota}
                  onChangeNota={setNota}
                  onEnviarNota={handleEnviarNota}
                  enviando={enviandoNota}
                  onAgendar={() => setAgendarOpen(true)}
                  onWhatsApp={() => setWhatsappOpen(true)}
                  statusQualif={statusQualif}
                  onChangeStatusQualif={handleChangeStatusQualificacao}
                  salvandoStatus={salvandoStatus}
                  arquivos={arquivos}
                  enviandoArquivo={enviandoArquivo}
                  onUploadArquivo={handleUploadArquivo}
                  onExcluirArquivo={handleExcluirArquivo}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>

    <ModalAgendarFollowUp
      open={agendarOpen}
      onClose={() => setAgendarOpen(false)}
      onSuccess={recarregarTimeline}
      clienteId={cliente.id}
      clienteNome={cliente.nome}
    />

    <ModalWhatsApp
      open={whatsappOpen}
      onClose={() => setWhatsappOpen(false)}
      onSent={recarregarTimeline}
      cliente={cliente}
    />
    </>
  )
}

// ── CONFIG ───────────────────────────────────────────────────────

const TABS = [
  { key: 'compras' as const,  label: 'Compras',      Icon: ShoppingBag },
  { key: 'servicos' as const, label: 'Serviços',     Icon: Wrench },
  { key: 'resumo' as const,   label: 'Resumo Geral', Icon: BarChart3 },
  { key: 'timeline' as const, label: 'Timeline',     Icon: History },
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

function getVendedorNome(venda: VendaComItens) {
  const vendedor = Array.isArray(venda.vendedor) ? venda.vendedor[0] : venda.vendedor
  return vendedor?.nome ?? 'Sem vendedor'
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
                    <span className="inline-flex min-w-0 max-w-full items-center gap-1 text-xs text-[#6B5E4E]">
                      <UserRound size={12} className="text-[#A68B3C] flex-shrink-0" />
                      <span className="truncate">{getVendedorNome(venda)}</span>
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

// ── TAB TIMELINE ─────────────────────────────────────────────────

const TIMELINE_ICON = { nota: FileText, status: Repeat, sistema: History } as const

interface TabTimelineProps {
  cliente: Cliente
  eventos: ClienteTimelineEvento[]
  nota: string
  onChangeNota: (value: string) => void
  onEnviarNota: () => void
  enviando: boolean
  onAgendar: () => void
  onWhatsApp: () => void
  statusQualif: StatusQualificacao
  onChangeStatusQualif: (status: StatusQualificacao) => void
  salvandoStatus: boolean
  arquivos: ClienteArquivo[]
  enviandoArquivo: ClienteArquivoTipo | null
  onUploadArquivo: (file: File | undefined, tipo: ClienteArquivoTipo) => Promise<void>
  onExcluirArquivo: (arquivo: ClienteArquivo) => Promise<void>
}

function TabTimeline({
  cliente, eventos, nota, onChangeNota, onEnviarNota, enviando, onAgendar, onWhatsApp,
  statusQualif, onChangeStatusQualif, salvandoStatus,
  arquivos, enviandoArquivo, onUploadArquivo, onExcluirArquivo,
}: TabTimelineProps) {
  return (
    <div className="space-y-5">
      {/* Resumo CRM */}
      <div className="rounded-xl border border-[#F0EBE0] bg-[#FAF7F0] p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Badge variant={statusFunilVariant(cliente.status_funil)}>
              {STATUS_FUNIL_LABEL[cliente.status_funil]}
            </Badge>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={12}
                  className={i < cliente.lead_score ? 'text-[#C9A84C]' : 'text-[#E8D5A3]'}
                  fill="currentColor"
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {cliente.telefone && (
              <Button variant="secondary" size="sm" leftIcon={<MessageCircle size={12} />} onClick={onWhatsApp}>
                WhatsApp
              </Button>
            )}
            <Button variant="secondary" size="sm" leftIcon={<CalendarClock size={12} />} onClick={onAgendar}>
              Agendar retorno
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_QUALIFICACAO_COR[statusQualif] }}
          />
          <select
            className="input-base !h-8 !py-0 text-xs flex-1 max-w-[220px]"
            value={statusQualif}
            disabled={salvandoStatus}
            onChange={(e) => onChangeStatusQualif(e.target.value as StatusQualificacao)}
          >
            {STATUS_QUALIFICACAO_OPTS.map((s) => (
              <option key={s} value={s}>{STATUS_QUALIFICACAO_LABEL[s]}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
          <div>
            <p className="text-[#9E9484]">Origem</p>
            <p className="text-[#2D2418] font-medium">{cliente.origem?.nome || cliente.origem_outro || '—'}</p>
          </div>
          <div>
            <p className="text-[#9E9484]">Produto de interesse</p>
            <p className="text-[#2D2418] font-medium">
              {cliente.produto_interesse ? PRODUTO_INTERESSE_LABEL[cliente.produto_interesse] : '—'}
            </p>
          </div>
          <div>
            <p className="text-[#9E9484]">Vendedor</p>
            <p className="text-[#2D2418] font-medium">{cliente.vendedor?.nome || '—'}</p>
          </div>
          <div>
            <p className="text-[#9E9484]">Valor pretendido</p>
            <p className="text-[#2D2418] font-medium">
              {cliente.valor_pretendido ? formatMoney(cliente.valor_pretendido) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[#9E9484]">Data do casamento</p>
            <p className="text-[#2D2418] font-medium">{cliente.data_casamento ? formatDate(cliente.data_casamento) : '—'}</p>
          </div>
          <div>
            <p className="text-[#9E9484]">Data do noivado</p>
            <p className="text-[#2D2418] font-medium">{cliente.data_noivado ? formatDate(cliente.data_noivado) : '—'}</p>
          </div>
          {cliente.parceiro_nome && (
            <div>
              <p className="text-[#9E9484]">Parceiro(a)</p>
              <p className="text-[#2D2418] font-medium">
                {cliente.parceiro_nome}{cliente.parceiro_telefone ? ` · ${formatPhone(cliente.parceiro_telefone)}` : ''}
              </p>
            </div>
          )}
        </div>
        {cliente.status_funil === 'lead_perdido' && cliente.motivo_perda && (
          <p className="text-xs text-red-600 mt-3 pt-3 border-t border-red-100">
            <strong>Motivo da perda:</strong> {cliente.motivo_perda}
          </p>
        )}
      </div>

      {/* Anexos: fotos de modelos e documentos/comprovantes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-[#6B5E4E] uppercase tracking-wide">Anexos</p>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#A68B3C] hover:text-[#8A7230] cursor-pointer transition-colors">
              {enviandoArquivo === 'foto' ? 'Enviando...' : '+ Foto'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={!!enviandoArquivo}
                onChange={(e) => { void onUploadArquivo(e.target.files?.[0], 'foto'); e.target.value = '' }}
              />
            </label>
            <label className="text-xs font-medium text-[#A68B3C] hover:text-[#8A7230] cursor-pointer transition-colors">
              {enviandoArquivo === 'documento' ? 'Enviando...' : '+ Documento'}
              <input
                type="file"
                className="hidden"
                disabled={!!enviandoArquivo}
                onChange={(e) => { void onUploadArquivo(e.target.files?.[0], 'documento'); e.target.value = '' }}
              />
            </label>
          </div>
        </div>
        {arquivos.length === 0 ? (
          <p className="text-xs text-[#9E9484]">Nenhum arquivo anexado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {arquivos.map((arquivo) => (
              <div key={arquivo.id} className="relative group">
                {arquivo.tipo === 'foto' ? (
                  <a href={getArquivoUrl(arquivo.url)} target="_blank" rel="noopener noreferrer">
                    <Image
                      src={getArquivoUrl(arquivo.url)}
                      alt={arquivo.nome}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-cover border border-[#F0EBE0]"
                      unoptimized
                    />
                  </a>
                ) : (
                  <a
                    href={getArquivoUrl(arquivo.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center w-16 h-16 rounded-lg border border-[#F0EBE0] bg-[#FAF7F0] text-center px-1"
                    title={arquivo.nome}
                  >
                    <FileText size={18} className="text-[#A68B3C]" />
                    <span className="text-[9px] text-[#6B5E4E] truncate w-full mt-0.5">{arquivo.nome}</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => void onExcluirArquivo(arquivo)}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Excluir arquivo"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adicionar nota */}
      <div className="flex flex-col gap-2">
        <Textarea
          value={nota}
          onChange={(e) => onChangeNota(e.target.value)}
          placeholder="Registrar um atendimento, retorno ou observação..."
          rows={2}
        />
        <Button
          variant="secondary"
          size="sm"
          className="self-end"
          leftIcon={<Send size={12} />}
          onClick={onEnviarNota}
          loading={enviando}
          disabled={!nota.trim()}
        >
          Adicionar nota
        </Button>
      </div>

      {/* Lista de eventos */}
      {eventos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Image
            src="/images/No data-cuate.svg"
            alt="Sem eventos"
            width={140}
            height={140}
            className="opacity-80 mb-3"
          />
          <p className="text-sm font-medium text-[#6B5E4E]">Nenhum evento registrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {eventos.map((evento) => {
            const Icon = TIMELINE_ICON[evento.tipo]
            return (
              <div key={evento.id} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-[#F5ECD0] flex items-center justify-center flex-shrink-0 text-[#A68B3C]">
                  <Icon size={13} />
                </div>
                <div className="flex-1 min-w-0 pb-3 border-b border-[#F0EBE0] last:border-0">
                  <p className="text-sm text-[#2D2418] leading-snug">{evento.descricao}</p>
                  <p className="text-xs text-[#9E9484] mt-0.5">
                    {formatDateTime(evento.created_at)}
                    {evento.autor?.nome && <> · {evento.autor.nome}</>}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
