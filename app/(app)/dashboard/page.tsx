'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ShoppingCart, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MetricCard, Card, CardHeader, Badge, Spinner, EmptyState } from '@/components/ui'
import {
  formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL,
} from '@/utils'
import type { VendaComCliente, VwEstoqueAtual } from '@/types'

interface MonthStat {
  mes: string
  total: number
}

interface DashboardState {
  faturamentoMes: number
  faturamentoAnterior: number
  saldoCaixa: number
  crediarioAberto: number
  servicosAndamento: number
  vendasRecentes: VendaComCliente[]
  estoqueCritico: VwEstoqueAtual[]
  faturamentoMeses: MonthStat[]
  loading: boolean
}

const INITIAL: DashboardState = {
  faturamentoMes: 0,
  faturamentoAnterior: 0,
  saldoCaixa: 0,
  crediarioAberto: 0,
  servicosAndamento: 0,
  vendasRecentes: [],
  estoqueCritico: [],
  faturamentoMeses: [],
  loading: true,
}

export default function DashboardPage() {
  const [state, setState] = useState<DashboardState>(INITIAL)

  async function loadDashboard() {
    const now = new Date()
    const mesInicio = format(startOfMonth(now), 'yyyy-MM-dd')
    const mesFim = format(endOfMonth(now), 'yyyy-MM-dd')
    const mesAnteriorInicio = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
    const mesAnteriorFim = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')

    const [
      { data: vendasMes },
      { data: vendasAnterior },
      { data: lancamentos },
      { data: parcelasPendentes },
      { data: servicos },
      { data: vendasRecentes },
      { data: estoqueCritico },
    ] = await Promise.all([
      supabase.from('vendas').select('total').neq('status', 'cancelado')
        .gte('data_venda', mesInicio).lte('data_venda', mesFim),
      supabase.from('vendas').select('total').neq('status', 'cancelado')
        .gte('data_venda', mesAnteriorInicio).lte('data_venda', mesAnteriorFim),
      supabase.from('lancamentos').select('tipo, valor'),
      supabase.from('crediario_parcelas').select('id').in('status', ['pendente', 'vencido']),
      supabase.from('servicos').select('id').in('status', ['aguardando', 'em_andamento']),
      supabase.from('vendas')
        .select('*, cliente:clientes(nome, telefone)')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('vw_estoque_atual').select('*')
        .in('status_estoque', ['critico', 'esgotado']).limit(5),
    ])

    const faturamentoMes = (vendasMes ?? []).reduce((s, v) => s + (v.total || 0), 0)
    const faturamentoAnterior = (vendasAnterior ?? []).reduce((s, v) => s + (v.total || 0), 0)
    const saldoCaixa = (lancamentos ?? []).reduce(
      (s, l) => l.tipo === 'entrada' ? s + l.valor : s - l.valor, 0
    )

    // Chart: 6 meses (simplificado com faturamento do mês atual)
    const faturamentoMeses: MonthStat[] = Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(now, 5 - i)
      return {
        mes: format(m, 'MMM', { locale: ptBR }),
        total: i === 5 ? faturamentoMes : 0,
      }
    })

    setState({
      faturamentoMes,
      faturamentoAnterior,
      saldoCaixa,
      crediarioAberto: parcelasPendentes?.length ?? 0,
      servicosAndamento: servicos?.length ?? 0,
      vendasRecentes: (vendasRecentes as VendaComCliente[]) ?? [],
      estoqueCritico: (estoqueCritico as VwEstoqueAtual[]) ?? [],
      faturamentoMeses,
      loading: false,
    })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadDashboard(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const variacao = state.faturamentoAnterior > 0
    ? ((state.faturamentoMes - state.faturamentoAnterior) / state.faturamentoAnterior * 100).toFixed(1)
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
      {/* Cabeçalho */}
      <div>
        <h1 className="font-display text-2xl font-medium text-dark-800">Painel Geral</h1>
        <p className="text-xs text-dark-300 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Faturamento do Mês"
          value={formatMoney(state.faturamentoMes)}
          change={variacao
            ? `${parseFloat(variacao) >= 0 ? '+' : ''}${variacao}% vs mês anterior`
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
          label="Serviços em Andamento"
          value={state.servicosAndamento}
          changeType="neutral"
        />
      </div>

      {/* Gráfico + Vendas Recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Faturamento — Últimos 6 Meses" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={state.faturamentoMeses} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: '#9C8B72' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9C8B72' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
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
        </Card>

        <Card>
          <CardHeader title="Vendas Recentes" />
          {state.vendasRecentes.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={24} />}
              title="Sem vendas recentes"
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

      {/* Estoque Crítico */}
      {state.estoqueCritico.length > 0 && (
        <Card>
          <CardHeader
            title="Estoque Crítico"
            subtitle="Produtos com estoque abaixo do mínimo"
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
                    {item.status_estoque === 'esgotado' ? 'Esgotado' : 'Crítico'}
                  </Badge>
                  <p className="text-xs text-dark-300 mt-0.5">
                    {item.estoque_atual} un / mín {item.estoque_minimo}
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
            title="Nenhum dado disponível"
            description="Conecte o banco de dados para visualizar o painel."
          />
        </Card>
      )}
    </div>
  )
}
