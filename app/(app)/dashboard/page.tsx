'use client'

import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import {
  MetricCard, Card, CardHeader, Badge, Spinner, EmptyState,
  PeriodFilter, getPeriodRange, type PeriodPreset,
} from '@/components/ui'
import {
  formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL,
} from '@/utils'
import type { VendaComCliente, VwEstoqueAtual } from '@/types'

interface PeriodStat {
  periodo: string
  total: number
}

interface DashboardVenda {
  total: number
  data_venda: string
}

interface DashboardLancamento {
  tipo: 'entrada' | 'saida'
  valor: number
  referencia_tipo: string | null
}

interface DashboardParcela {
  valor: number
  valor_pago: number | null
}

interface DashboardServico {
  id: string
  status: string
  valor: number
  pago: boolean
}

interface DashboardState {
  faturamentoPeriodo: number
  faturamentoAnterior: number
  entradasPeriodo: number
  saidasPeriodo: number
  saldoCaixa: number
  crediarioAberto: number
  crediarioAbertoValor: number
  servicosRecebidos: number
  servicosPeriodo: number
  servicosAndamento: number
  estoqueCriticoQtd: number
  vendasRecentes: VendaComCliente[]
  estoqueCritico: VwEstoqueAtual[]
  faturamentoSeries: PeriodStat[]
  loading: boolean
}

const INITIAL: DashboardState = {
  faturamentoPeriodo: 0,
  faturamentoAnterior: 0,
  entradasPeriodo: 0,
  saidasPeriodo: 0,
  saldoCaixa: 0,
  crediarioAberto: 0,
  crediarioAbertoValor: 0,
  servicosRecebidos: 0,
  servicosPeriodo: 0,
  servicosAndamento: 0,
  estoqueCriticoQtd: 0,
  vendasRecentes: [],
  estoqueCritico: [],
  faturamentoSeries: [],
  loading: true,
}

function buildFaturamentoSeries(vendas: DashboardVenda[], dataInicio: string, dataFim: string) {
  const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45
  const totals = new Map<string, number>()

  vendas.forEach((venda) => {
    const date = parseISO(venda.data_venda)
    const key = useDay ? format(date, 'dd/MM') : format(date, 'MMM/yy', { locale: ptBR })
    totals.set(key, (totals.get(key) ?? 0) + (venda.total ?? 0))
  })

  return Array.from(totals.entries()).map(([periodo, total]) => ({ periodo, total }))
}

export default function DashboardPage() {
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [state, setState] = useState<DashboardState>(INITIAL)

  const loadDashboard = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))

    const inicio = parseISO(dataInicio)
    const fim = parseISO(dataFim)
    const diasPeriodo = Math.max(0, differenceInCalendarDays(fim, inicio))
    const periodoAnteriorFim = format(subDays(inicio, 1), 'yyyy-MM-dd')
    const periodoAnteriorInicio = format(subDays(inicio, diasPeriodo + 1), 'yyyy-MM-dd')

    const [
      { data: vendasPeriodo },
      { data: vendasPeriodoAnterior },
      { data: lancamentos },
      { data: parcelasPendentes },
      { data: servicos },
      { data: vendasRecentes },
      { data: estoqueCritico },
    ] = await Promise.all([
      supabase.from('vendas')
        .select('total, data_venda')
        .neq('status', 'cancelado')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim),
      supabase.from('vendas')
        .select('total')
        .neq('status', 'cancelado')
        .gte('data_venda', periodoAnteriorInicio)
        .lte('data_venda', periodoAnteriorFim),
      supabase.from('lancamentos')
        .select('tipo, valor, referencia_tipo')
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim),
      supabase.from('crediario_parcelas')
        .select('valor, valor_pago')
        .in('status', ['pendente', 'vencido'])
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim),
      supabase.from('servicos')
        .select('id, status, valor, pago')
        .gte('data_entrada', dataInicio)
        .lte('data_entrada', dataFim),
      supabase.from('vendas')
        .select('*, cliente:clientes(nome, telefone)')
        .neq('status', 'cancelado')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('vw_estoque_atual')
        .select('*')
        .in('status_estoque', ['critico', 'esgotado'])
        .limit(5),
    ])

    const vendas = ((vendasPeriodo ?? []) as unknown) as DashboardVenda[]
    const lancamentosPeriodo = ((lancamentos ?? []) as unknown) as DashboardLancamento[]
    const parcelasPeriodo = ((parcelasPendentes ?? []) as unknown) as DashboardParcela[]
    const servicosPeriodoRows = ((servicos ?? []) as unknown) as DashboardServico[]
    const faturamentoPeriodo = vendas.reduce((sum, venda) => sum + (venda.total || 0), 0)
    const faturamentoAnterior = (vendasPeriodoAnterior ?? []).reduce((sum, venda) => sum + (venda.total || 0), 0)
    const entradasPeriodo = lancamentosPeriodo
      .filter((lancamento) => lancamento.tipo === 'entrada')
      .reduce((sum, lancamento) => sum + (lancamento.valor ?? 0), 0)
    const saidasPeriodo = lancamentosPeriodo
      .filter((lancamento) => lancamento.tipo === 'saida')
      .reduce((sum, lancamento) => sum + (lancamento.valor ?? 0), 0)
    const saldoCaixa = lancamentosPeriodo.reduce(
      (sum, lancamento) => lancamento.tipo === 'entrada' ? sum + lancamento.valor : sum - lancamento.valor,
      0,
    )
    const servicosAtivos = servicosPeriodoRows.filter((servico) => servico.status !== 'cancelado')
    const servicosRecebidos = servicosAtivos
      .filter((servico) => servico.pago)
      .reduce((sum, servico) => sum + (servico.valor ?? 0), 0)
    const crediarioAbertoValor = parcelasPeriodo.reduce(
      (sum, parcela) => sum + Math.max(0, (parcela.valor ?? 0) - (parcela.valor_pago ?? 0)),
      0,
    )
    const estoqueCriticoRows = (estoqueCritico as VwEstoqueAtual[]) ?? []

    setState({
      faturamentoPeriodo,
      faturamentoAnterior,
      entradasPeriodo,
      saidasPeriodo,
      saldoCaixa,
      crediarioAberto: parcelasPeriodo.length,
      crediarioAbertoValor,
      servicosRecebidos,
      servicosPeriodo: servicosAtivos.length,
      servicosAndamento: servicosPeriodoRows.filter((servico) => ['aguardando', 'em_andamento'].includes(servico.status)).length,
      estoqueCriticoQtd: estoqueCriticoRows.length,
      vendasRecentes: (vendasRecentes as VendaComCliente[]) ?? [],
      estoqueCritico: estoqueCriticoRows,
      faturamentoSeries: buildFaturamentoSeries(vendas, dataInicio, dataFim),
      loading: false,
    })
  }, [dataFim, dataInicio])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadDashboard(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadDashboard])

  const variacao = state.faturamentoAnterior > 0
    ? ((state.faturamentoPeriodo - state.faturamentoAnterior) / state.faturamentoAnterior * 100).toFixed(1)
    : null
  const movimentoTotal = state.faturamentoPeriodo + state.servicosRecebidos

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-dark-800">Painel Geral</h1>
        <p className="text-xs text-dark-300 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <Card>
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
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Vendas"
          value={formatMoney(state.faturamentoPeriodo)}
          change={variacao
            ? `${parseFloat(variacao) >= 0 ? '+' : ''}${variacao}% vs periodo anterior`
            : undefined}
          changeType={variacao
            ? (parseFloat(variacao) >= 0 ? 'up' : 'down')
            : 'neutral'}
          accent
        />
        <MetricCard
          label="Servicos Recebidos"
          value={formatMoney(state.servicosRecebidos)}
          change={`${state.servicosPeriodo} ordem(ns) no periodo`}
          changeType="neutral"
        />
        <MetricCard
          label="Saldo em Caixa"
          value={formatMoney(state.saldoCaixa)}
          changeType={state.saldoCaixa >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          label="Crediario em Aberto"
          value={formatMoney(state.crediarioAbertoValor)}
          change={`${state.crediarioAberto} parcela(s)`}
          changeType={state.crediarioAbertoValor > 0 ? 'down' : 'neutral'}
        />
      </div>

      <Card>
        <CardHeader
          title="Resumo Geral do Periodo"
          subtitle="Vendas, servicos, caixa, crediario e estoque em uma visao unica"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="rounded-lg border border-gold-100 bg-cream-50 p-4">
            <p className="text-xs uppercase tracking-[1px] text-dark-400 font-semibold">Movimento Total</p>
            <p className="font-display text-2xl font-semibold text-dark-600 mt-2">{formatMoney(movimentoTotal)}</p>
            <p className="text-xs text-dark-300 mt-1">Vendas + servicos recebidos</p>
          </div>
          <div className="rounded-lg border border-gold-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[1px] text-dark-400 font-semibold">Caixa</p>
            <p className="font-display text-2xl font-semibold text-dark-600 mt-2">{formatMoney(state.entradasPeriodo - state.saidasPeriodo)}</p>
            <p className="text-xs text-dark-300 mt-1">
              {formatMoney(state.entradasPeriodo)} entradas / {formatMoney(state.saidasPeriodo)} saidas
            </p>
          </div>
          <div className="rounded-lg border border-gold-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[1px] text-dark-400 font-semibold">Operacao</p>
            <p className="font-display text-2xl font-semibold text-dark-600 mt-2">{state.servicosAndamento}</p>
            <p className="text-xs text-dark-300 mt-1">servico(s) em andamento</p>
          </div>
          <div className="rounded-lg border border-gold-100 bg-white p-4">
            <p className="text-xs uppercase tracking-[1px] text-dark-400 font-semibold">Alertas</p>
            <p className="font-display text-2xl font-semibold text-dark-600 mt-2">{state.estoqueCriticoQtd}</p>
            <p className="text-xs text-dark-300 mt-1">item(ns) com estoque critico</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento - Periodo Selecionado" />
          {state.faturamentoSeries.length === 0 ? (
            <EmptyState
              imageSrc="/images/Analytics-rafiki.svg"
              title="Sem faturamento no periodo"
            />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={state.faturamentoSeries} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
                <XAxis
                  dataKey="periodo"
                  tick={{ fontSize: 11, fill: '#9C8B72' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9C8B72' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `R$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), 'Faturamento']}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #EBD9A4',
                    fontSize: 12,
                    fontFamily: 'var(--font-dm-sans)',
                  }}
                />
                <Bar dataKey="total" fill="#B8962E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <CardHeader title="Vendas Recentes" />
          {state.vendasRecentes.length === 0 ? (
            <EmptyState
              imageSrc="/images/Shopping-bro.svg"
              title="Sem vendas no periodo"
            />
          ) : (
            <div className="space-y-3">
              {state.vendasRecentes.map((venda) => (
                <div key={venda.id} className="flex items-start justify-between py-1 border-b border-gold-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-dark-700 leading-tight">
                      {venda.cliente?.nome || 'Sem cliente'}
                    </p>
                    <p className="text-xs text-dark-300 mt-0.5">{formatDate(venda.data_venda)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-dark-700">{formatMoney(venda.total)}</p>
                    <Badge variant={vendaStatusVariant(venda.status)} className="mt-0.5">
                      {VENDA_STATUS_LABEL[venda.status]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {state.estoqueCritico.length > 0 && (
        <Card>
          <CardHeader
            title="Estoque Critico"
            subtitle="Produtos com estoque abaixo do minimo"
          />
          <div className="divide-y divide-gold-50">
            {state.estoqueCritico.map((item) => (
              <div key={item.variacao_id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium text-dark-700">{item.produto_nome}</p>
                  <p className="text-xs text-dark-300 mt-0.5">
                    {item.variacao_nome}: {item.variacao_valor}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={item.status_estoque === 'esgotado' ? 'danger' : 'warning'}>
                    {item.status_estoque === 'esgotado' ? 'Esgotado' : 'Critico'}
                  </Badge>
                  <p className="text-xs text-dark-300 mt-0.5">
                    {item.estoque_atual} un / min {item.estoque_minimo}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {state.estoqueCritico.length === 0 && state.vendasRecentes.length === 0 && (
        <Card>
          <EmptyState
            imageSrc="/images/No data-cuate.svg"
            title="Nenhum dado disponivel"
            description="Ajuste o periodo ou conecte o banco de dados para visualizar o painel."
          />
        </Card>
      )}
    </div>
  )
}
