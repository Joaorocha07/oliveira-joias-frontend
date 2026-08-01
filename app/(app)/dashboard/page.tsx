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
  formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL, today,
} from '@/utils'
import { listarContasPagar } from '@/services/contas-pagar'
import type { VendaComCliente, VwEstoqueAtual, ContaPagar } from '@/types'

interface PeriodStat {
  periodo: string
  total: number
}

interface DashboardVenda {
  total: number
  data_venda: string
  forma_pagamento: string
  cliente_id: string | null
  origem_id: string | null
  origem_outro: string | null
}

interface DashboardRecebimento {
  valor: number
  data: string
}

interface DashboardParcelaPaga {
  valor_pago: number
  data_pagamento: string | null
}

interface DashboardCrediarioEntrada {
  entrada: number
  created_at: string
}

interface DashboardLancamento {
  tipo: 'entrada' | 'saida'
  descricao: string | null
  valor: number
  referencia_tipo: string | null
  forma_pagamento: string | null
}


interface DashboardServico {
  id: string
  status: string
  valor: number
  custo_estimado: number | null
  pago: boolean
  origem_id: string | null
  origem_outro: string | null
}

interface DashboardOrigem {
  id: string
  nome: string
  ativo: boolean
}

interface DashboardCliente {
  id: string
  ativo: boolean
  created_at: string
}

interface DashboardState {
  faturamentoPeriodo: number
  faturamentoAnterior: number
  entradasPeriodo: number
  saidasPeriodo: number
  saldoCaixa: number
  crediarioAberto: number
  crediarioAbertoValor: number
  crediarioRecebidoPeriodo: number
  servicosRecebidos: number
  servicosCustoPeriodo: number
  servicosPeriodo: number
  servicosAndamento: number
  estoqueUnidadesTotal: number
  estoqueCriticoQtd: number
  vendasQtdPeriodo: number
  leadsTotal: number
  leadsCanaisDistintos: number
  leadsCanalPrincipal: string | null
  leadsSemOrigem: number
  contasPendentesQtd: number
  contasVencidasQtd: number
  contasTotalPendente: number
  contasValorVencido: number
  clientesCadastrados: number
  clientesAtivos: number
  clientesNovosPeriodo: number
  clientesAtendidosPeriodo: number
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
  crediarioRecebidoPeriodo: 0,
  servicosRecebidos: 0,
  servicosCustoPeriodo: 0,
  servicosPeriodo: 0,
  servicosAndamento: 0,
  estoqueUnidadesTotal: 0,
  estoqueCriticoQtd: 0,
  vendasQtdPeriodo: 0,
  leadsTotal: 0,
  leadsCanaisDistintos: 0,
  leadsCanalPrincipal: null,
  leadsSemOrigem: 0,
  contasPendentesQtd: 0,
  contasVencidasQtd: 0,
  contasTotalPendente: 0,
  contasValorVencido: 0,
  clientesCadastrados: 0,
  clientesAtivos: 0,
  clientesNovosPeriodo: 0,
  clientesAtendidosPeriodo: 0,
  vendasRecentes: [],
  estoqueCritico: [],
  faturamentoSeries: [],
  loading: true,
}

function buildFaturamentoSeries(recebimentos: DashboardRecebimento[], dataInicio: string, dataFim: string) {
  const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45
  const totals = new Map<string, number>()

  recebimentos.forEach((recebimento) => {
    const date = parseISO(recebimento.data)
    const key = useDay ? format(date, 'dd/MM') : format(date, 'MMM/yy', { locale: ptBR })
    totals.set(key, (totals.get(key) ?? 0) + (recebimento.valor ?? 0))
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

    const lancamentos = await (async () => {
      const pageSize = 1000
      const all: Array<{ tipo: string; descricao: string; valor: number; referencia_tipo: string; forma_pagamento: string }> = []
      let offset = 0
      while (true) {
        const { data } = await supabase
          .from('lancamentos')
          .select('tipo, descricao, valor, referencia_tipo, forma_pagamento')
          .gte('data_lancamento', dataInicio)
          .lte('data_lancamento', dataFim)
          .range(offset, offset + pageSize - 1)
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < pageSize) break
        offset += pageSize
      }
      return all
    })()

    const [
      { data: vendasPeriodo },
      { data: vendasPeriodoAnterior },
      { data: parcelasPagasPeriodo },
      { data: parcelasPagasPeriodoAnterior },
      { data: entradasCrediarioPeriodo },
      { data: entradasCrediarioPeriodoAnterior },
      { data: crediariosAbertos },
      { data: servicos },
      { data: vendasRecentes },
      { data: estoqueTodos },
      { data: origensCliente },
      { data: clientes },
      { data: contasPagar },
    ] = await Promise.all([
      supabase.from('vendas')
        .select('total, data_venda, forma_pagamento, cliente_id, origem_id, origem_outro')
        .neq('status', 'cancelado')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim),
      supabase.from('vendas')
        .select('total, data_venda, forma_pagamento, cliente_id, origem_id, origem_outro')
        .neq('status', 'cancelado')
        .gte('data_venda', periodoAnteriorInicio)
        .lte('data_venda', periodoAnteriorFim),
      supabase.from('crediario_parcelas')
        .select('valor_pago, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', dataInicio)
        .lte('data_pagamento', dataFim),
      supabase.from('crediario_parcelas')
        .select('valor_pago, data_pagamento')
        .eq('status', 'pago')
        .gte('data_pagamento', periodoAnteriorInicio)
        .lte('data_pagamento', periodoAnteriorFim),
      supabase.from('crediario')
        .select('entrada, created_at')
        .gt('entrada', 0)
        .not('status', 'eq', 'cancelado')
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`),
      supabase.from('crediario')
        .select('entrada, created_at')
        .gt('entrada', 0)
        .not('status', 'eq', 'cancelado')
        .gte('created_at', `${periodoAnteriorInicio}T00:00:00`)
        .lte('created_at', `${periodoAnteriorFim}T23:59:59`),
      supabase.from('crediario')
        .select('saldo')
        .in('status', ['em_dia', 'vencido']),
      supabase.from('servicos')
        .select('id, status, valor, custo_estimado, pago, origem_id, origem_outro')
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
        .select('*'),
      supabase.from('origens_cliente')
        .select('id, nome, ativo')
        .eq('ativo', true),
      supabase.from('clientes')
        .select('id, ativo, created_at'),
      listarContasPagar().then((result) => ({ data: result.data })),
    ])

    const vendas = ((vendasPeriodo ?? []) as unknown) as DashboardVenda[]
    const vendasRecebidas = vendas.filter((venda) => venda.forma_pagamento !== 'crediario')
    const vendasRecebidasPeriodoAnterior = (((vendasPeriodoAnterior ?? []) as unknown) as DashboardVenda[])
      .filter((venda) => venda.forma_pagamento !== 'crediario')
    const parcelasPagas = ((parcelasPagasPeriodo ?? []) as unknown) as DashboardParcelaPaga[]
    const parcelasPagasAnterior = ((parcelasPagasPeriodoAnterior ?? []) as unknown) as DashboardParcelaPaga[]
    const entradasCrediario = ((entradasCrediarioPeriodo ?? []) as unknown) as DashboardCrediarioEntrada[]
    const entradasCrediarioAnterior = ((entradasCrediarioPeriodoAnterior ?? []) as unknown) as DashboardCrediarioEntrada[]
    const recebimentosPeriodo: DashboardRecebimento[] = [
      ...vendasRecebidas.map((venda) => ({ valor: venda.total ?? 0, data: venda.data_venda })),
      ...parcelasPagas.map((parcela) => ({ valor: parcela.valor_pago ?? 0, data: parcela.data_pagamento ?? dataInicio })),
      ...entradasCrediario.map((crediario) => ({ valor: crediario.entrada ?? 0, data: crediario.created_at })),
    ]
    const recebimentosPeriodoAnterior: DashboardRecebimento[] = [
      ...vendasRecebidasPeriodoAnterior.map((venda) => ({ valor: venda.total ?? 0, data: venda.data_venda })),
      ...parcelasPagasAnterior.map((parcela) => ({ valor: parcela.valor_pago ?? 0, data: parcela.data_pagamento ?? periodoAnteriorInicio })),
      ...entradasCrediarioAnterior.map((crediario) => ({ valor: crediario.entrada ?? 0, data: crediario.created_at })),
    ]
    const lancamentosPeriodo = ((lancamentos ?? []) as unknown) as DashboardLancamento[]
    const servicosPeriodoRows = ((servicos ?? []) as unknown) as DashboardServico[]
    const faturamentoPeriodo = recebimentosPeriodo.reduce((sum, recebimento) => sum + recebimento.valor, 0)
    const faturamentoAnterior = recebimentosPeriodoAnterior.reduce((sum, recebimento) => sum + recebimento.valor, 0)
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
    const servicosCustoPeriodo = servicosAtivos.reduce((sum, servico) => sum + (servico.custo_estimado ?? 0), 0)
    const crediarioAbertoValor = ((crediariosAbertos ?? []) as { saldo: number }[]).reduce((sum, c) => sum + (c.saldo ?? 0), 0)
    const crediarioRecebidoPeriodo = entradasCrediario.reduce((sum, c) => sum + (c.entrada ?? 0), 0)
      + parcelasPagas.reduce((sum, p) => sum + (p.valor_pago ?? 0), 0)
    const estoqueRows = (estoqueTodos as VwEstoqueAtual[]) ?? []
    const estoqueAlertaRows = estoqueRows.filter((item) => item.status_estoque !== 'normal')
    const estoqueCriticoRows = estoqueAlertaRows.slice(0, 5)
    const estoqueUnidadesTotal = estoqueRows.reduce((sum, item) => sum + (item.estoque_atual ?? 0), 0)

    // Leads: origem registrada em vendas e serviços do período
    const origensRows = ((origensCliente ?? []) as unknown) as DashboardOrigem[]
    const origemById = new Map(origensRows.map((o) => [o.id, o.nome]))
    const leadsCount = new Map<string, number>()
    const registrarLead = (origemId: string | null, origemOutro: string | null) => {
      let nome: string | null = null
      if (origemId) nome = origemById.get(origemId) ?? 'Desconhecida'
      else if (origemOutro) nome = origemOutro
      if (!nome) return
      leadsCount.set(nome, (leadsCount.get(nome) ?? 0) + 1)
    }
    vendas.forEach((v) => registrarLead(v.origem_id, v.origem_outro))
    servicosPeriodoRows.forEach((s) => registrarLead(s.origem_id, s.origem_outro))
    const leadsRanking = Array.from(leadsCount.entries()).sort((a, b) => b[1] - a[1])
    const leadsSemOrigem = vendas.filter((v) => !v.origem_id && !v.origem_outro).length
      + servicosPeriodoRows.filter((s) => !s.origem_id && !s.origem_outro).length

    // Contas a pagar
    const contasPagarRows = (contasPagar ?? []) as ContaPagar[]
    const todayStr = today()
    const contasPendentes = contasPagarRows.filter((c) => c.status === 'pendente')
    const contasVencidas = contasPendentes.filter((c) => c.data_vencimento < todayStr)

    // Clientes
    const clientesRows = ((clientes ?? []) as unknown) as DashboardCliente[]
    const clientesAtendidosPeriodo = new Set(vendas.filter((v) => v.cliente_id).map((v) => v.cliente_id)).size
    const clientesNovosPeriodo = clientesRows.filter((c) => c.created_at >= dataInicio && c.created_at <= `${dataFim}T23:59:59`).length

    setState({
      faturamentoPeriodo,
      faturamentoAnterior,
      entradasPeriodo,
      saidasPeriodo,
      saldoCaixa,
      crediarioAberto: (crediariosAbertos ?? []).length,
      crediarioAbertoValor,
      crediarioRecebidoPeriodo,
      servicosRecebidos,
      servicosCustoPeriodo,
      servicosPeriodo: servicosAtivos.length,
      servicosAndamento: servicosPeriodoRows.filter((servico) => ['aguardando', 'em_andamento'].includes(servico.status)).length,
      estoqueUnidadesTotal,
      estoqueCriticoQtd: estoqueAlertaRows.length,
      vendasQtdPeriodo: vendas.length,
      leadsTotal: leadsRanking.reduce((sum, [, count]) => sum + count, 0),
      leadsCanaisDistintos: leadsRanking.length,
      leadsCanalPrincipal: leadsRanking[0]?.[0] ?? null,
      leadsSemOrigem,
      contasPendentesQtd: contasPendentes.length,
      contasVencidasQtd: contasVencidas.length,
      contasTotalPendente: contasPendentes.reduce((sum, c) => sum + c.valor, 0),
      contasValorVencido: contasVencidas.reduce((sum, c) => sum + c.valor, 0),
      clientesCadastrados: clientesRows.length,
      clientesAtivos: clientesRows.filter((c) => c.ativo).length,
      clientesNovosPeriodo,
      clientesAtendidosPeriodo,
      vendasRecentes: (vendasRecentes as VendaComCliente[]) ?? [],
      estoqueCritico: estoqueCriticoRows,
      faturamentoSeries: buildFaturamentoSeries(recebimentosPeriodo, dataInicio, dataFim),
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
          label="Vendas Recebidas"
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
          label="Resultado do Período"
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
          title="Resumo Financeiro do Período"
          subtitle="Entradas, despesas, resultado e indicadores operacionais consolidados"
        />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-gold-200 bg-cream-50 p-4">
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Movimento Total</p>
            <p className="font-display text-2xl font-semibold text-dark-700 mt-2">{formatMoney(movimentoTotal)}</p>
            <p className="text-xs text-dark-300 mt-1">Vendas + serviços recebidos</p>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Entradas</p>
            <p className="font-display text-2xl font-semibold text-green-700 mt-2">{formatMoney(state.entradasPeriodo)}</p>
            <p className="text-xs text-dark-300 mt-1">Lançamentos recebidos</p>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Despesas</p>
            <p className="font-display text-2xl font-semibold text-red-600 mt-2">{formatMoney(state.saidasPeriodo)}</p>
            <p className="text-xs text-dark-300 mt-1">Saídas do período</p>
          </div>
          <div className={`rounded-xl border p-4 ${state.saldoCaixa >= 0 ? 'border-green-200 bg-green-50/60' : 'border-red-200 bg-red-50/50'}`}>
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Resultado</p>
            <p className={`font-display text-2xl font-semibold mt-2 ${state.saldoCaixa >= 0 ? 'text-green-700' : 'text-red-600'}`}>
              {formatMoney(state.saldoCaixa)}
            </p>
            <p className="text-xs text-dark-300 mt-1">
              {movimentoTotal > 0 ? `Margem ${(state.saldoCaixa / movimentoTotal * 100).toFixed(1)}%` : 'Sem faturamento'}
            </p>
          </div>
        </div>

        {state.entradasPeriodo > 0 && (
          <div className="mb-5">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium text-green-700">{formatMoney(state.entradasPeriodo)} entradas</span>
              <span className="font-medium text-red-600">{formatMoney(state.saidasPeriodo)} despesas</span>
            </div>
            <div className="h-2 bg-red-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (state.entradasPeriodo / (state.entradasPeriodo + state.saidasPeriodo)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-dark-300 mt-1">
              {((state.entradasPeriodo / (state.entradasPeriodo + state.saidasPeriodo)) * 100).toFixed(0)}% das movimentações são entradas
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gold-100">
          <div>
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Crediário Pendente</p>
            <p className="text-base font-semibold text-dark-700 mt-1">{formatMoney(state.crediarioAbertoValor)}</p>
            <p className="text-xs text-dark-300 mt-0.5">{state.crediarioAberto} crediário(s) em aberto</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Serviços Ativos</p>
            <p className="text-base font-semibold text-dark-700 mt-1">{state.servicosAndamento}</p>
            <p className="text-xs text-dark-300 mt-0.5">em andamento no período</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Estoque Crítico</p>
            <p className={`text-base font-semibold mt-1 ${state.estoqueCriticoQtd > 0 ? 'text-red-600' : 'text-green-700'}`}>
              {state.estoqueCriticoQtd > 0 ? `${state.estoqueCriticoQtd} item(ns)` : 'Sem alertas'}
            </p>
            <p className="text-xs text-dark-300 mt-0.5">
              {state.estoqueCriticoQtd > 0 ? 'necessita reposição' : 'estoque normalizado'}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Resumo por Área"
          subtitle="Panorama de cada módulo do sistema no período selecionado"
        />
        <div className="divide-y divide-gold-50">
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Vendas</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.vendasQtdPeriodo} venda(s) · ticket médio {formatMoney(state.vendasQtdPeriodo > 0 ? state.faturamentoPeriodo / state.vendasQtdPeriodo : 0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-dark-700">{formatMoney(state.faturamentoPeriodo)}</p>
              <p className="text-xs text-dark-400 mt-0.5">recebido no período</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Despesas e Caixa</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {formatMoney(state.entradasPeriodo)} entradas · {formatMoney(state.saidasPeriodo)} saídas
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${state.saldoCaixa >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {formatMoney(state.saldoCaixa)}
              </p>
              <p className="text-xs text-dark-400 mt-0.5">resultado</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Serviços</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.servicosPeriodo} ordem(ns) · {state.servicosAndamento} em andamento
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-dark-700">{formatMoney(state.servicosRecebidos)}</p>
              <p className="text-xs text-green-700 mt-0.5">lucro {formatMoney(state.servicosRecebidos - state.servicosCustoPeriodo)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Estoque</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.estoqueUnidadesTotal} un · {state.estoqueCriticoQtd} alerta(s)
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${state.estoqueCriticoQtd > 0 ? 'text-red-600' : 'text-green-700'}`}>
                {state.estoqueCriticoQtd > 0 ? `${state.estoqueCriticoQtd} em alerta` : 'Normalizado'}
              </p>
              <p className="text-xs text-dark-400 mt-0.5">produtos críticos/esgotados</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Crediário</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.crediarioAberto} contrato(s) em aberto
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-dark-700">{formatMoney(state.crediarioRecebidoPeriodo)}</p>
              <p className="text-xs text-dark-400 mt-0.5">{formatMoney(state.crediarioAbertoValor)} a receber</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Leads</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.leadsTotal} lead(s) · {state.leadsCanaisDistintos} canal(is)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-dark-700">{state.leadsCanalPrincipal ?? '—'}</p>
              <p className={`text-xs mt-0.5 ${state.leadsSemOrigem > 0 ? 'text-red-600' : 'text-dark-400'}`}>
                {state.leadsSemOrigem} sem origem
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Contas a Pagar</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.contasVencidasQtd > 0 ? `${state.contasVencidasQtd} vencida(s)` : `${state.contasPendentesQtd} pendente(s)`}
              </p>
            </div>
            <div className="text-right">
              <p className={`text-sm font-semibold ${state.contasVencidasQtd > 0 ? 'text-red-600' : 'text-dark-700'}`}>
                {formatMoney(state.contasTotalPendente)}
              </p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.contasVencidasQtd > 0 ? `${formatMoney(state.contasValorVencido)} vencido` : 'Em dia'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold text-dark-700">Clientes</p>
              <p className="text-xs text-dark-400 mt-0.5">
                {state.clientesCadastrados} cadastrado(s) · {state.clientesAtivos} ativo(s)
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-dark-700">{state.clientesAtendidosPeriodo} atendido(s)</p>
              <p className="text-xs text-dark-400 mt-0.5">{state.clientesNovosPeriodo} novo(s) no período</p>
            </div>
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
