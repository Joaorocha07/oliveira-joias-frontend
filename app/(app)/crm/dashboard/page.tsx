'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Lightbulb, TrendingUp, TrendingDown, Users, Pencil } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, CardHeader, MetricCard, Spinner, EmptyState, Modal, Button,
  PeriodFilter, getPeriodRange, type PeriodPreset,
} from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { listarAlertas } from '@/services/follow-ups'
import { upsertMetaMensal } from '@/services/metas'
import { formatMoney, today, PRODUTO_INTERESSE_LABEL } from '@/utils'
import type { ProdutoInteresse } from '@/types'

interface LeadRow {
  id: string
  origem_id: string | null
  origem_outro: string | null
  produto_interesse: ProdutoInteresse | null
  vendedor_id: string | null
  created_at: string
  origem?: { nome: string } | null
}

interface VendaRow {
  id: string
  total: number
  data_venda: string
  vendedor_id: string | null
}

interface VendedorRanking {
  id: string
  nome: string
  comissaoPercentual: number
  leads: number
  vendas: number
  valorVendido: number
}

export default function CrmDashboardPage() {
  const { user, profile } = useAuth()
  const alert = useAlert()
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [loading, setLoading] = useState(true)
  const [metaModalOpen, setMetaModalOpen] = useState(false)
  const [metaInput, setMetaInput] = useState(0)
  const [salvandoMeta, setSalvandoMeta] = useState(false)

  const [leads, setLeads] = useState<LeadRow[]>([])
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [orcamentosRealizados, setOrcamentosRealizados] = useState(0)
  const [leadsPerdidos, setLeadsPerdidos] = useState(0)
  const [vendedores, setVendedores] = useState<{ id: string; nome: string; comissao_percentual: number }[]>([])
  const [metaMensal, setMetaMensal] = useState(0)
  const [valorVendidoMes, setValorVendidoMes] = useState(0)
  const [valorVendidoHoje, setValorVendidoHoje] = useState(0)
  const [followUpsHoje, setFollowUpsHoje] = useState(0)
  const [valorEmNegociacao, setValorEmNegociacao] = useState(0)

  const escopoVendedor = profile?.role === 'vendedor' ? profile.id : undefined

  const carregar = useCallback(async () => {
    setLoading(true)
    const hojeStr = today()
    const inicioMes = format(new Date(), 'yyyy-MM-01')

    let leadsQuery = supabase
      .from('clientes')
      .select('id, origem_id, origem_outro, produto_interesse, vendedor_id, created_at, origem:origens_cliente(nome)')
      .eq('ativo', true)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
    if (escopoVendedor) leadsQuery = leadsQuery.or(`vendedor_id.eq.${escopoVendedor},vendedor_id.is.null`)

    let vendasQuery = supabase
      .from('vendas')
      .select('id, total, data_venda, vendedor_id')
      .neq('status', 'cancelado')
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim)
    if (escopoVendedor) vendasQuery = vendasQuery.eq('vendedor_id', escopoVendedor)

    const timelineQuery = supabase
      .from('cliente_timeline')
      .select('status_novo, cliente:clientes(vendedor_id)')
      .eq('tipo', 'status')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)

    let vendasMesQuery = supabase
      .from('vendas')
      .select('total, vendedor_id')
      .neq('status', 'cancelado')
      .gte('data_venda', inicioMes)
    if (escopoVendedor) vendasMesQuery = vendasMesQuery.eq('vendedor_id', escopoVendedor)

    let vendasHojeQuery = supabase
      .from('vendas')
      .select('total, vendedor_id')
      .neq('status', 'cancelado')
      .eq('data_venda', hojeStr)
    if (escopoVendedor) vendasHojeQuery = vendasHojeQuery.eq('vendedor_id', escopoVendedor)

    let emNegociacaoQuery = supabase
      .from('clientes')
      .select('valor_pretendido')
      .eq('ativo', true)
      .not('status_funil', 'in', '(pos_venda,lead_perdido)')
    if (escopoVendedor) emNegociacaoQuery = emNegociacaoQuery.or(`vendedor_id.eq.${escopoVendedor},vendedor_id.is.null`)

    const [
      leadsRes, vendasRes, timelineRes, vendedoresRes, metasRes,
      vendasMesRes, vendasHojeRes, alertasRes, emNegociacaoRes,
    ] = await Promise.all([
      leadsQuery,
      vendasQuery,
      timelineQuery,
      supabase.from('profiles').select('id, nome, comissao_percentual').eq('ativo', true).in('role', ['vendedor', 'admin']),
      supabase.from('metas_mensais').select('valor_meta, vendedor_id').eq('mes', inicioMes),
      vendasMesQuery,
      vendasHojeQuery,
      listarAlertas(escopoVendedor),
      emNegociacaoQuery,
    ])

    if (leadsRes.error) alert.error('Erro', 'Erro ao carregar indicadores do CRM.')

    setLeads((leadsRes.data ?? []) as unknown as LeadRow[])
    setVendas((vendasRes.data ?? []) as VendaRow[])

    const timelineRows = (timelineRes.data ?? []) as unknown as { status_novo: string | null; cliente: { vendedor_id: string | null } | null }[]
    const timelineEscopo = escopoVendedor
      ? timelineRows.filter((r) => !r.cliente?.vendedor_id || r.cliente.vendedor_id === escopoVendedor)
      : timelineRows
    setOrcamentosRealizados(timelineEscopo.filter((r) => r.status_novo === 'orcamento').length)
    setLeadsPerdidos(timelineEscopo.filter((r) => r.status_novo === 'lead_perdido').length)

    setVendedores((vendedoresRes.data ?? []) as { id: string; nome: string; comissao_percentual: number }[])

    const metas = (metasRes.data ?? []) as { valor_meta: number; vendedor_id: string | null }[]
    const metaRow = escopoVendedor
      ? metas.find((m) => m.vendedor_id === escopoVendedor)
      : metas.find((m) => m.vendedor_id === null)
    setMetaMensal(metaRow?.valor_meta ?? 0)

    setValorVendidoMes(((vendasMesRes.data ?? []) as { total: number }[]).reduce((s, v) => s + v.total, 0))
    setValorVendidoHoje(((vendasHojeRes.data ?? []) as { total: number }[]).reduce((s, v) => s + v.total, 0))
    setFollowUpsHoje(!alertasRes.error ? alertasRes.data?.followUpsVencidosCount ?? 0 : 0)
    setValorEmNegociacao(
      ((emNegociacaoRes.data ?? []) as { valor_pretendido: number | null }[])
        .reduce((s, c) => s + (c.valor_pretendido ?? 0), 0)
    )

    setLoading(false)
  }, [dataInicio, dataFim, escopoVendedor])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [carregar])

  const leadsRecebidos = leads.length
  const vendasConcluidas = vendas.length
  const valorVendidoPeriodo = vendas.reduce((s, v) => s + v.total, 0)
  const ticketMedio = vendasConcluidas > 0 ? valorVendidoPeriodo / vendasConcluidas : 0
  const taxaConversao = leadsRecebidos > 0 ? (vendasConcluidas / leadsRecebidos) * 100 : 0
  const percentualMeta = metaMensal > 0 ? (valorVendidoMes / metaMensal) * 100 : 0

  const origemSeries = useMemo(() => {
    const map = new Map<string, number>()
    leads.forEach((l) => {
      const nome = l.origem?.nome || l.origem_outro || 'Não informado'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total)
  }, [leads])

  const produtoSeries = useMemo(() => {
    const map = new Map<string, number>()
    leads.forEach((l) => {
      const nome = l.produto_interesse ? PRODUTO_INTERESSE_LABEL[l.produto_interesse] : 'Não informado'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total)
  }, [leads])

  const rankingVendedores: VendedorRanking[] = useMemo(() => {
    return vendedores.map((v) => {
      const leadsDoVendedor = leads.filter((l) => l.vendedor_id === v.id).length
      const vendasDoVendedor = vendas.filter((ve) => ve.vendedor_id === v.id)
      const valorVendido = vendasDoVendedor.reduce((s, ve) => s + ve.total, 0)
      return {
        id: v.id,
        nome: v.nome,
        comissaoPercentual: v.comissao_percentual,
        leads: leadsDoVendedor,
        vendas: vendasDoVendedor.length,
        valorVendido,
      }
    }).sort((a, b) => b.valorVendido - a.valorVendido)
  }, [vendedores, leads, vendas])

  const insights = useMemo(() => {
    const lista: string[] = []
    if (origemSeries.length > 0 && leadsRecebidos > 0) {
      const top = origemSeries[0]
      lista.push(`${top.nome} gerou ${((top.total / leadsRecebidos) * 100).toFixed(0)}% dos leads no período.`)
    }
    if (produtoSeries.length > 0 && leadsRecebidos > 0) {
      const top = produtoSeries[0]
      lista.push(`${top.nome} representa ${((top.total / leadsRecebidos) * 100).toFixed(0)}% do interesse dos leads.`)
    }
    const rankingComVendas = rankingVendedores.filter((v) => v.leads > 0)
    if (rankingComVendas.length > 0) {
      const melhor = [...rankingComVendas].sort((a, b) => (b.vendas / b.leads) - (a.vendas / a.leads))[0]
      const conversao = (melhor.vendas / melhor.leads) * 100
      if (conversao > 0) lista.push(`${melhor.nome} tem a maior taxa de conversão (${conversao.toFixed(0)}%).`)
    }
    if (followUpsHoje > 0) {
      lista.push(`${followUpsHoje} follow-up${followUpsHoje !== 1 ? 's' : ''} vencido${followUpsHoje !== 1 ? 's' : ''} precisa${followUpsHoje !== 1 ? 'm' : ''} de atenção.`)
    }
    if (leadsPerdidos > 0) {
      lista.push(`Você perdeu ${leadsPerdidos} oportunidade${leadsPerdidos !== 1 ? 's' : ''} no período.`)
    }
    return lista
  }, [origemSeries, produtoSeries, rankingVendedores, leadsRecebidos, followUpsHoje, leadsPerdidos])

  async function handleSalvarMeta() {
    if (!user) return
    setSalvandoMeta(true)
    const inicioMes = format(new Date(), 'yyyy-MM-01')
    const { error } = await upsertMetaMensal(inicioMes, escopoVendedor ?? null, metaInput, user.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      setMetaMensal(metaInput)
      setMetaModalOpen(false)
    }
    setSalvandoMeta(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader title="CRM · Dashboard" subtitle="Indicadores do funil de vendas em tempo real" />

      <Card>
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          activePreset={activePreset}
          onChange={({ inicio, fim, preset }) => { setDataInicio(inicio); setDataFim(fim); setActivePreset(preset) }}
        />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Leads Recebidos" value={leadsRecebidos} accent />
        <MetricCard label="Orçamentos Realizados" value={orcamentosRealizados} />
        <MetricCard label="Vendas Concluídas" value={vendasConcluidas} />
        <MetricCard label="Taxa de Conversão" value={`${taxaConversao.toFixed(1)}%`} />
        <MetricCard label="Ticket Médio" value={formatMoney(ticketMedio)} />
        <MetricCard label="Valor Vendido Hoje" value={formatMoney(valorVendidoHoje)} />
        <MetricCard label="Valor Vendido no Mês" value={formatMoney(valorVendidoMes)} />
        <Card className="relative">
          <button
            type="button"
            onClick={() => { setMetaInput(metaMensal); setMetaModalOpen(true) }}
            className="absolute top-4 right-4 text-dark-300 hover:text-gold-500 transition-colors"
            title="Definir meta"
          >
            <Pencil size={13} />
          </button>
          <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold mb-2">Meta Mensal</p>
          <p className="font-display text-2xl font-semibold text-dark-500 tabular-nums">
            {metaMensal > 0 ? `${percentualMeta.toFixed(0)}%` : '—'}
          </p>
          <p className="text-xs mt-1.5 font-medium text-dark-300">
            {metaMensal > 0 ? `de ${formatMoney(metaMensal)}` : 'Sem meta definida'}
          </p>
        </Card>
      </div>

      {insights.length > 0 && (
        <Card>
          <CardHeader title="Insights" subtitle="Calculado a partir dos dados do período — sem IA/custo de API" />
          <div className="space-y-2">
            {insights.map((texto, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-dark-600">
                <Lightbulb size={14} className="text-gold-500 flex-shrink-0 mt-0.5" />
                <span>{texto}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Origem dos Leads" />
          {origemSeries.length === 0 ? (
            <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem leads no período" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={origemSeries} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
                <Bar dataKey="total" fill="#B8962E" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Produtos Mais Procurados" />
          {produtoSeries.length === 0 ? (
            <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem leads no período" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={produtoSeries} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
                <Bar dataKey="total" fill="#5B8EB8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="p-5 pb-0">
          <CardHeader title="Ranking dos Vendedores" />
        </div>
        {rankingVendedores.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState imageSrc="/images/Profile Interface-rafiki.svg" title="Nenhum vendedor cadastrado" />
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Nome</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Leads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Vendas</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Conversão</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Ticket Médio</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor Vendido</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {rankingVendedores.map((v) => {
                  const conversao = v.leads > 0 ? (v.vendas / v.leads) * 100 : 0
                  const ticketMedioVendedor = v.vendas > 0 ? v.valorVendido / v.vendas : 0
                  const comissao = v.valorVendido * (v.comissaoPercentual / 100)
                  return (
                    <tr key={v.id} className="hover:bg-[#FAF7F0] transition-colors">
                      <td className="px-5 py-3 font-medium text-dark-700">{v.nome}</td>
                      <td className="px-5 py-3 text-right text-dark-400">{v.leads}</td>
                      <td className="px-5 py-3 text-right text-dark-400">{v.vendas}</td>
                      <td className="px-5 py-3 text-right text-dark-400">{conversao.toFixed(0)}%</td>
                      <td className="px-5 py-3 text-right text-dark-400">{formatMoney(ticketMedioVendedor)}</td>
                      <td className="px-5 py-3 text-right font-medium text-dark-700">{formatMoney(v.valorVendido)}</td>
                      <td className="px-5 py-3 text-right text-green-700">{formatMoney(comissao)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gold-50 flex items-center justify-center text-gold-600 flex-shrink-0">
            <Users size={16} />
          </div>
          <div>
            <p className="text-xs text-dark-400">Valor em Negociação</p>
            <p className="text-sm font-semibold text-dark-700">{formatMoney(valorEmNegociacao)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600 flex-shrink-0">
            <TrendingUp size={16} />
          </div>
          <div>
            <p className="text-xs text-dark-400">Vendas no Período</p>
            <p className="text-sm font-semibold text-dark-700">{formatMoney(valorVendidoPeriodo)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center text-red-600 flex-shrink-0">
            <TrendingDown size={16} />
          </div>
          <div>
            <p className="text-xs text-dark-400">Leads Perdidos</p>
            <p className="text-sm font-semibold text-dark-700">{leadsPerdidos}</p>
          </div>
        </Card>
      </div>

      <Modal
        open={metaModalOpen}
        onClose={() => setMetaModalOpen(false)}
        title="Definir meta mensal"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setMetaModalOpen(false)} disabled={salvandoMeta}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => void handleSalvarMeta()} loading={salvandoMeta}>
              Salvar
            </Button>
          </>
        }
      >
        <CurrencyInput
          label={escopoVendedor ? 'Sua meta para este mês' : 'Meta geral da loja para este mês'}
          value={metaInput}
          onChange={setMetaInput}
        />
      </Modal>
    </div>
  )
}
