'use client'

import { useCallback, useEffect, useState } from 'react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
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

interface DashboardState {
  faturamentoPeriodo: number
  faturamentoAnterior: number
  saldoCaixa: number
  crediarioAberto: number
  servicosAndamento: number
  vendasRecentes: VendaComCliente[]
  estoqueCritico: VwEstoqueAtual[]
  faturamentoSeries: PeriodStat[]
  loading: boolean
}

const INITIAL: DashboardState = {
  faturamentoPeriodo: 0,
  faturamentoAnterior: 0,
  saldoCaixa: 0,
  crediarioAberto: 0,
  servicosAndamento: 0,
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
        .select('tipo, valor')
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim),
      supabase.from('crediario_parcelas')
        .select('id')
        .in('status', ['pendente', 'vencido'])
        .gte('data_vencimento', dataInicio)
        .lte('data_vencimento', dataFim),
      supabase.from('servicos')
        .select('id')
        .in('status', ['aguardando', 'em_andamento'])
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
    const faturamentoPeriodo = vendas.reduce((sum, venda) => sum + (venda.total || 0), 0)
    const faturamentoAnterior = (vendasPeriodoAnterior ?? []).reduce((sum, venda) => sum + (venda.total || 0), 0)
    const saldoCaixa = (lancamentos ?? []).reduce(
      (sum, lancamento) => lancamento.tipo === 'entrada' ? sum + lancamento.valor : sum - lancamento.valor,
      0,
    )

    setState({
      faturamentoPeriodo,
      faturamentoAnterior,
      saldoCaixa,
      crediarioAberto: parcelasPendentes?.length ?? 0,
      servicosAndamento: servicos?.length ?? 0,
      vendasRecentes: (vendasRecentes as VendaComCliente[]) ?? [],
      estoqueCritico: (estoqueCritico as VwEstoqueAtual[]) ?? [],
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
          label="Faturamento"
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
          label="Saldo em Caixa"
          value={formatMoney(state.saldoCaixa)}
          changeType={state.saldoCaixa >= 0 ? 'up' : 'down'}
        />
        <MetricCard
          label="Parcelas em Aberto"
          value={state.crediarioAberto}
          changeType="neutral"
        />
        <MetricCard
          label="Servicos em Andamento"
          value={state.servicosAndamento}
          changeType="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento - Periodo Selecionado" />
          {state.faturamentoSeries.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={24} />}
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
              icon={<ShoppingCart size={24} />}
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
            icon={<AlertTriangle size={24} />}
            title="Nenhum dado disponivel"
            description="Ajuste o periodo ou conecte o banco de dados para visualizar o painel."
          />
        </Card>
      )}
    </div>
  )
}
