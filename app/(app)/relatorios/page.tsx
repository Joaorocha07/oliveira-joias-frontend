'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, CardHeader, MetricCard, Spinner, EmptyState,
  PeriodFilter, getPeriodRange, Button, type PeriodPreset,
} from '@/components/ui'
import { formatMoney, PRODUTO_CATEGORIA_LABEL, SERVICO_STATUS_LABEL } from '@/utils'
import type { EstoqueMovimentoTipo, ProdutoCategoria, VwEstoqueAtual, ServicoStatus } from '@/types'

const CHART_COLORS = ['#B8962E', '#C49A35', '#D4AF5A', '#EBD9A4', '#9A7B22', '#7A5C10', '#5C4208', '#3D2B05']

type ReportSection = 'vendas' | 'caixa' | 'servicos' | 'estoque' | 'crediario'
type CaixaChartMode = 'evolucao' | 'categorias' | 'lancamentos'

const REPORT_SECTIONS: { key: ReportSection; label: string; subtitle: string }[] = [
  { key: 'vendas', label: 'Vendas', subtitle: 'Faturamento e lucro' },
  { key: 'caixa', label: 'Despesas e Caixa', subtitle: 'Entradas e saidas' },
  { key: 'servicos', label: 'Servicos', subtitle: 'Ordens e receita' },
  { key: 'estoque', label: 'Estoque', subtitle: 'Movimentacoes e alertas' },
  { key: 'crediario', label: 'Crediario', subtitle: 'Parcelas e recebimentos' },
]

interface CategoriaData { name: string; value: number }
interface SerieData { periodo: string; entradas: number; despesas: number }

interface VendaRelatorio {
  id: string
  total: number
  data_venda: string
  forma_pagamento: string
  itens?: {
    produto_id: string | null
    subtotal: number
    custo_unitario: number
    quantidade: number
    nome_produto: string
    produto?: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null
  }[] | null
}

interface LancamentoRelatorio {
  tipo: 'entrada' | 'saida'
  descricao: string
  valor: number
  data_lancamento: string
  categoria_nome: string | null
  referencia_tipo: string | null
}

interface ServicoRelatorio {
  status: ServicoStatus
  tipo: string
  valor: number
  custo_estimado: number | null
  pago: boolean
  data_entrada: string
}

interface MovimentoEstoqueRelatorio {
  tipo: EstoqueMovimentoTipo
  quantidade: number
  created_at: string
  produto?: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null
}

interface ParcelaRelatorio {
  valor: number
  valor_pago: number
  data_vencimento: string
  data_pagamento: string | null
  status: string
}

function periodKey(dateValue: string, useDay: boolean) {
  const date = parseISO(dateValue)
  return useDay ? format(date, 'dd/MM') : format(date, 'MMM/yy', { locale: ptBR })
}

function numberFormat(value: number) {
  return `R$${(value / 1000).toFixed(0)}k`
}

function getProdutoCategoria(produto: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null | undefined) {
  if (!produto) return null
  return Array.isArray(produto) ? produto[0]?.categoria ?? null : produto.categoria
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-2">
      <h2 className="text-lg font-serif text-dark-800">{title}</h2>
      <p className="text-sm text-dark-400 mt-0.5">{subtitle}</p>
    </div>
  )
}

function ReportBlock({ children }: { children: ReactNode }) {
  return <div className="space-y-6">{children}</div>
}

export default function RelatoriosPage() {
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [activeSection, setActiveSection] = useState<ReportSection>('vendas')
  const [caixaChartMode, setCaixaChartMode] = useState<CaixaChartMode>('evolucao')
  const [loading, setLoading] = useState(true)

  const [vendas, setVendas] = useState<VendaRelatorio[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRelatorio[]>([])
  const [servicos, setServicos] = useState<ServicoRelatorio[]>([])
  const [movimentosEstoque, setMovimentosEstoque] = useState<MovimentoEstoqueRelatorio[]>([])
  const [parcelas, setParcelas] = useState<ParcelaRelatorio[]>([])
  const [estoqueAtual, setEstoqueAtual] = useState({ unidades: 0, alertas: 0, produtosCriticos: 0 })
  const [estoqueDetalhado, setEstoqueDetalhado] = useState<VwEstoqueAtual[]>([])

  const loadRelatorios = useCallback(async () => {
    setLoading(true)
    const inicioCompleto = `${dataInicio}T00:00:00`
    const fimCompleto = `${dataFim}T23:59:59`

    const [vendasResult, lancamentosResult, servicosResult, movimentosResult, parcelasResult, estoqueResult] = await Promise.all([
      supabase
        .from('vendas')
        .select('id, total, data_venda, forma_pagamento, itens:venda_itens(produto_id, nome_produto, subtotal, custo_unitario, quantidade, produto:produtos(categoria))')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .not('status', 'eq', 'cancelado'),
      supabase
        .from('lancamentos')
        .select('tipo, descricao, valor, data_lancamento, categoria_nome, referencia_tipo')
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim),
      supabase
        .from('servicos')
        .select('status, tipo, valor, custo_estimado, pago, data_entrada')
        .gte('data_entrada', dataInicio)
        .lte('data_entrada', dataFim),
      supabase
        .from('estoque_movimentacoes')
        .select('tipo, quantidade, created_at, produto:produtos(categoria)')
        .gte('created_at', inicioCompleto)
        .lte('created_at', fimCompleto),
      supabase
        .from('crediario_parcelas')
        .select('valor, valor_pago, data_vencimento, data_pagamento, status')
        .or(`and(data_vencimento.gte.${dataInicio},data_vencimento.lte.${dataFim}),and(data_pagamento.gte.${dataInicio},data_pagamento.lte.${dataFim})`),
      supabase
        .from('vw_estoque_atual')
        .select('produto_id, produto_nome, categoria, custo, preco_venda, estoque_atual, status_estoque'),
    ])

    setVendas(((vendasResult.data ?? []) as unknown) as VendaRelatorio[])
    setLancamentos((lancamentosResult.data as LancamentoRelatorio[]) ?? [])
    setServicos((servicosResult.data as ServicoRelatorio[]) ?? [])
    setMovimentosEstoque(((movimentosResult.data ?? []) as unknown) as MovimentoEstoqueRelatorio[])
    setParcelas((parcelasResult.data as ParcelaRelatorio[]) ?? [])

    const estoqueRows = (estoqueResult.data ?? []) as VwEstoqueAtual[]
    const produtosEmAlerta = new Set(estoqueRows.filter((row) => row.status_estoque !== 'normal').map((row) => row.produto_id))
    setEstoqueAtual({
      unidades: estoqueRows.reduce((sum, row) => sum + (row.estoque_atual ?? 0), 0),
      alertas: estoqueRows.filter((row) => row.status_estoque !== 'normal').length,
      produtosCriticos: produtosEmAlerta.size,
    })
    setEstoqueDetalhado(estoqueRows)

    setLoading(false)
  }, [dataFim, dataInicio])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadRelatorios(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadRelatorios])

  const metrics = useMemo(() => {
    const faturamento = vendas.reduce((sum, venda) => sum + (venda.total ?? 0), 0)
    const custo = vendas.reduce((sum, venda) => (
      sum + (venda.itens ?? []).reduce((itemSum, item) => itemSum + ((item.custo_unitario ?? 0) * (item.quantidade ?? 0)), 0)
    ), 0)
    const despesas = lancamentos.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.valor, 0)
    const entradas = lancamentos.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + item.valor, 0)

    const servicosAtivos = servicos.filter((s) => s.status !== 'cancelado')
    const servicoValorTotal = servicosAtivos.reduce((sum, s) => sum + (s.valor ?? 0), 0)
    const servicoRecebido = servicosAtivos
      .filter((s) => s.pago)
      .reduce((sum, s) => sum + (s.valor ?? 0), 0)
    const servicoSaidas = servicosAtivos
      .reduce((sum, s) => sum + (s.custo_estimado ?? 0), 0)
    const servicoLucro = servicoRecebido - servicoSaidas
    const servicosQtd = servicos.length
    const servicosPagos = servicosAtivos.filter((s) => s.pago)
    const servicosEmAberto = servicosAtivos.filter((s) => !s.pago)
    const servicoTicketMedio = servicosAtivos.length > 0
      ? servicosAtivos.reduce((sum, s) => sum + s.valor, 0) / servicosAtivos.length
      : 0
    const servicosAbertoValor = servicosEmAberto.reduce((sum, s) => sum + (s.valor ?? 0), 0)

    const estoqueEntradas = movimentosEstoque.filter((item) => item.tipo === 'entrada' || item.tipo === 'devolucao').reduce((sum, item) => sum + item.quantidade, 0)
    const estoqueSaidas = movimentosEstoque.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.quantidade, 0)
    const crediarioRecebido = parcelas
      .filter((parcela) => parcela.status === 'pago' && parcela.data_pagamento && parcela.data_pagamento >= dataInicio && parcela.data_pagamento <= dataFim)
      .reduce((sum, parcela) => sum + (parcela.valor_pago ?? 0), 0)
    const crediarioAVencer = parcelas
      .filter((parcela) => parcela.status !== 'pago' && parcela.data_vencimento >= dataInicio && parcela.data_vencimento <= dataFim)
      .reduce((sum, parcela) => sum + (parcela.valor ?? 0), 0)

    return {
      faturamento,
      lucroBruto: faturamento - custo,
      lucroLiquido: faturamento - custo - despesas,
      despesas,
      entradas,
      ticketMedio: vendas.length > 0 ? faturamento / vendas.length : 0,
      vendasQtd: vendas.length,
      servicoValorTotal,
      servicoRecebido,
      servicoSaidas,
      servicoLucro,
      servicosQtd,
      servicoTicketMedio,
      servicosPagosQtd: servicosPagos.length,
      servicosEmAberto: servicosEmAberto.length,
      servicosAbertoValor,
      servicosCancelados: servicos.filter((s) => s.status === 'cancelado').length,
      estoqueEntradas,
      estoqueSaidas,
      estoqueSaldo: estoqueEntradas - estoqueSaidas,
      crediarioRecebido,
      crediarioAVencer,
      crediarioParcelas: parcelas.length,
    }
  }, [dataFim, dataInicio, lancamentos, movimentosEstoque, parcelas, servicos, vendas])

  const charts = useMemo(() => {
    const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45
    const serieMap: Record<string, SerieData> = {}

    lancamentos.forEach((item) => {
      const key = periodKey(item.data_lancamento, useDay)
      serieMap[key] ??= { periodo: key, entradas: 0, despesas: 0 }
      if (item.tipo === 'entrada') serieMap[key].entradas += item.valor
      if (item.tipo === 'saida') serieMap[key].despesas += item.valor
    })

    const vendasProduto: Record<string, number> = {}
    vendas.forEach((venda) => {
      ;(venda.itens ?? []).forEach((item) => {
        const label = item.nome_produto || 'Produto sem nome'
        vendasProduto[label] = (vendasProduto[label] ?? 0) + (item.subtotal ?? 0)
      })
    })

    const despesasCat: Record<string, number> = {}
    lancamentos.filter((item) => item.tipo === 'saida').forEach((item) => {
      const label = item.categoria_nome ?? 'Outros'
      despesasCat[label] = (despesasCat[label] ?? 0) + item.valor
    })

    const lancamentosMap: Record<string, number> = {}
    lancamentos.forEach((item) => {
      const label = item.descricao || (item.tipo === 'entrada' ? 'Entrada' : 'Saida')
      const signedValue = item.tipo === 'entrada' ? item.valor : -item.valor
      lancamentosMap[label] = (lancamentosMap[label] ?? 0) + signedValue
    })

    const estoqueCat: Record<string, number> = {}
    movimentosEstoque.forEach((movimento) => {
      const categoria = getProdutoCategoria(movimento.produto)
      if (!categoria) return
      const label = PRODUTO_CATEGORIA_LABEL[categoria] ?? categoria
      estoqueCat[label] = (estoqueCat[label] ?? 0) + movimento.quantidade
    })

    const servicosStatusMap: Record<string, number> = {}
    servicos.forEach((s) => {
      servicosStatusMap[s.status] = (servicosStatusMap[s.status] ?? 0) + 1
    })
    const servicosStatus = Object.entries(servicosStatusMap)
      .map(([status, value]) => ({ name: SERVICO_STATUS_LABEL[status as ServicoStatus] ?? status, value }))
      .sort((a, b) => b.value - a.value)

    const servicosTipoMap: Record<string, number> = {}
    servicos.filter((s) => s.status !== 'cancelado').forEach((s) => {
      servicosTipoMap[s.tipo] = (servicosTipoMap[s.tipo] ?? 0) + s.valor
    })
    const servicosTipo = Object.entries(servicosTipoMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    return {
      serieFinanceira: Object.values(serieMap),
      vendasProduto: Object.entries(vendasProduto).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      despesasCategoria: Object.entries(despesasCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      lancamentos: Object.entries(lancamentosMap).map(([name, value]) => ({ name, value })).sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
      estoqueCategoria: Object.entries(estoqueCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      servicosStatus,
      servicosTipo,
    }
  }, [dataFim, dataInicio, lancamentos, movimentosEstoque, servicos, vendas])

  const investimentoData = useMemo(() => {
    const produtoMap = new Map<string, {
      produto_nome: string; categoria: ProdutoCategoria
      custo_estoque: number; potencial: number; estoque_qtd: number
    }>()
    estoqueDetalhado.forEach((row) => {
      const p = produtoMap.get(row.produto_id)
      if (p) {
        p.custo_estoque += row.custo * row.estoque_atual
        p.potencial += row.preco_venda * row.estoque_atual
        p.estoque_qtd += row.estoque_atual
      } else {
        produtoMap.set(row.produto_id, {
          produto_nome: row.produto_nome,
          categoria: row.categoria,
          custo_estoque: row.custo * row.estoque_atual,
          potencial: row.preco_venda * row.estoque_atual,
          estoque_qtd: row.estoque_atual,
        })
      }
    })

    const vendasMap = new Map<string, {
      nome_produto: string
      vendido_valor: number
      vendido_qtd: number
      custo_vendido: number
    }>()
    vendas.forEach((venda) => {
      ;(venda.itens ?? []).forEach((item) => {
        if (!item.produto_id) return
        const v = vendasMap.get(item.produto_id)
        if (v) {
          v.vendido_valor += item.subtotal
          v.vendido_qtd += item.quantidade
          v.custo_vendido += (item.custo_unitario ?? 0) * item.quantidade
        } else {
          vendasMap.set(item.produto_id, {
            nome_produto: item.nome_produto,
            vendido_valor: item.subtotal,
            vendido_qtd: item.quantidade,
            custo_vendido: (item.custo_unitario ?? 0) * item.quantidade,
          })
        }
      })
    })

    const allIds = new Set([...produtoMap.keys(), ...vendasMap.keys()])
    const produtos = Array.from(allIds).map((id) => {
      const est = produtoMap.get(id)
      const vnd = vendasMap.get(id)
      const custo_estoque = est?.custo_estoque ?? 0
      const custo_vendido = vnd?.custo_vendido ?? 0
      const investido = custo_estoque + custo_vendido
      const potencial = est?.potencial ?? 0
      const estoque_qtd = est?.estoque_qtd ?? 0
      const vendido_valor = vnd?.vendido_valor ?? 0
      const vendido_qtd = vnd?.vendido_qtd ?? 0
      const total_qtd = estoque_qtd + vendido_qtd
      const retorno_total = vendido_valor + potencial
      const pct_vendido = total_qtd > 0 ? (vendido_qtd / total_qtd) * 100 : 0
      const margem_potencial = investido > 0 ? ((retorno_total - investido) / investido) * 100 : 0
      return {
        produto_id: id,
        produto_nome: est?.produto_nome ?? vnd?.nome_produto ?? 'Produto',
        categoria: est?.categoria ?? ('outros' as ProdutoCategoria),
        investido, custo_estoque, custo_vendido,
        potencial, retorno_total, estoque_qtd,
        vendido_valor, vendido_qtd, total_qtd, pct_vendido, margem_potencial,
      }
    })
    .filter((p) => p.investido > 0 || p.vendido_valor > 0)
    .sort((a, b) => b.investido - a.investido)

    const totalInvestido = produtos.reduce((s, p) => s + p.investido, 0)
    const totalRetorno = produtos.reduce((s, p) => s + p.retorno_total, 0)
    const totalVendido = produtos.reduce((s, p) => s + p.vendido_valor, 0)
    const totalPotencial = produtos.reduce((s, p) => s + p.potencial, 0)
    const pctRealizado = totalRetorno > 0 ? (totalVendido / totalRetorno) * 100 : 0

    return { produtos, totalInvestido, totalRetorno, totalVendido, totalPotencial, pctRealizado }
  }, [estoqueDetalhado, vendas])

  return (
    <div className="space-y-6">
      <PageHeader title="Relatorios" subtitle="Analises separadas por vendas, servicos, estoque, despesas e crediario" />

      <Card>
        <div className="space-y-4">
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

          <div className="border-t border-gold-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-5 gap-2">
              {REPORT_SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  className={[
                    'min-h-14 rounded-lg border px-4 py-3 text-left transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
                    activeSection === section.key
                      ? 'border-gold-500 bg-gold-500 text-dark-800 shadow-sm'
                      : 'border-gold-100 bg-white text-dark-600 hover:bg-cream-50 hover:border-gold-200',
                  ].join(' ')}
                >
                  <span className="block text-sm font-medium leading-tight">{section.label}</span>
                  <span className={activeSection === section.key ? 'block text-xs text-dark-600 mt-1' : 'block text-xs text-dark-300 mt-1'}>
                    {section.subtitle}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Spinner size={28} /></div>
      ) : (
        <>
          {activeSection === 'vendas' && (
            <ReportBlock>
              <SectionTitle title="Vendas" subtitle="Faturamento, lucro e distribuicao por produto no periodo selecionado" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Faturamento" value={formatMoney(metrics.faturamento)} changeType="up" accent />
                <MetricCard label="Lucro Bruto" value={formatMoney(metrics.lucroBruto)} changeType={metrics.lucroBruto >= 0 ? 'up' : 'down'} />
                <MetricCard label="Ticket Medio" value={metrics.vendasQtd > 0 ? formatMoney(metrics.ticketMedio) : '-'} changeType="neutral" />
                <MetricCard label="Vendas" value={String(metrics.vendasQtd)} changeType="neutral" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader title="Vendas por Produto" />
                  {charts.vendasProduto.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas no periodo" />
                  ) : (
                    <PieReport data={charts.vendasProduto} />
                  )}
                </Card>
                <Card>
                  <CardHeader title="Comparativo de Resultado" />
                  <BarCompareReport
                    data={[
                      { name: 'Faturamento', value: metrics.faturamento },
                      { name: 'Lucro bruto', value: metrics.lucroBruto },
                      { name: 'Lucro liquido', value: metrics.lucroLiquido },
                    ]}
                  />
                </Card>
              </div>
            </ReportBlock>
          )}

          {activeSection === 'caixa' && (
            <ReportBlock>
              <SectionTitle title="Despesas e Caixa" subtitle="Entradas e saidas vindas dos lancamentos do banco de dados" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Entradas" value={formatMoney(metrics.entradas)} changeType="up" />
                <MetricCard label="Despesas" value={formatMoney(metrics.despesas)} changeType="down" />
                <MetricCard label="Lucro Liquido" value={formatMoney(metrics.entradas - metrics.despesas)} changeType={metrics.entradas >= metrics.despesas ? 'up' : 'down'} accent />
                <MetricCard label="Lucro Bruto Vendas" value={formatMoney(metrics.lucroBruto)} changeType={metrics.lucroBruto >= 0 ? 'up' : 'down'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader
                    title={caixaChartMode === 'evolucao'
                      ? 'Entradas vs Despesas - Periodo Selecionado'
                      : caixaChartMode === 'categorias'
                        ? 'Despesas por Categoria'
                        : 'Lancamentos - Periodo Selecionado'}
                    actions={
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant={caixaChartMode === 'evolucao' ? 'primary' : 'secondary'} onClick={() => setCaixaChartMode('evolucao')}>
                          Evolucao
                        </Button>
                        <Button size="sm" variant={caixaChartMode === 'categorias' ? 'primary' : 'secondary'} onClick={() => setCaixaChartMode('categorias')}>
                          Categorias
                        </Button>
                        <Button size="sm" variant={caixaChartMode === 'lancamentos' ? 'primary' : 'secondary'} onClick={() => setCaixaChartMode('lancamentos')}>
                          Lancamentos
                        </Button>
                      </div>
                    }
                  />

                  {caixaChartMode === 'evolucao' && (
                    charts.serieFinanceira.length === 0 ? (
                      <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem lancamentos no periodo" />
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={charts.serieFinanceira} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
                          <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} tickFormatter={numberFormat} />
                          <Tooltip formatter={(value, name) => [formatMoney(Number(value)), name === 'entradas' ? 'Entradas' : 'Despesas']} contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
                          <Bar dataKey="entradas" fill="#B8962E" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="despesas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )
                  )}

                  {caixaChartMode === 'categorias' && (
                    charts.despesasCategoria.length === 0 ? (
                      <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem despesas no periodo" />
                    ) : (
                      <PieReport data={charts.despesasCategoria} offset={3} />
                    )
                  )}

                  {caixaChartMode === 'lancamentos' && (
                    charts.lancamentos.length === 0 ? (
                      <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem lancamentos no periodo" />
                    ) : (
                      <BarCompareReport data={charts.lancamentos} />
                    )
                  )}
                </Card>
                <Card>
                  <CardHeader title="Resumo dos Lancamentos" />
                  {charts.lancamentos.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem lancamentos no periodo" />
                  ) : (
                    <BarCompareReport data={charts.lancamentos.slice(0, 8)} />
                  )}
                </Card>
              </div>
            </ReportBlock>
          )}

          {activeSection === 'servicos' && (
            <ReportBlock>
              <SectionTitle title="Servicos" subtitle="Ordens de servico criadas no periodo, receita e custos associados" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Recebido" value={formatMoney(metrics.servicoRecebido)} changeType="up" accent />
                <MetricCard label="Custos" value={formatMoney(metrics.servicoSaidas)} changeType={metrics.servicoSaidas > 0 ? 'down' : 'neutral'} />
                <MetricCard label="Lucro" value={formatMoney(metrics.servicoLucro)} changeType={metrics.servicoLucro >= 0 ? 'up' : 'down'} />
                <MetricCard label="Ordens no Periodo" value={String(metrics.servicosQtd)} changeType="neutral" />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Ticket Medio" value={metrics.servicoTicketMedio > 0 ? formatMoney(metrics.servicoTicketMedio) : '-'} changeType="neutral" />
                <MetricCard label="Pagas" value={String(metrics.servicosPagosQtd)} changeType="neutral" />
                <MetricCard label="A Receber" value={formatMoney(metrics.servicosAbertoValor)} change={`${metrics.servicosEmAberto} ordem(ns)`} changeType="neutral" />
                <MetricCard label="Canceladas" value={String(metrics.servicosCancelados)} changeType={metrics.servicosCancelados > 0 ? 'down' : 'neutral'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader title="Distribuicao por Status" />
                  {charts.servicosStatus.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem servicos no periodo" />
                  ) : (
                    <PieReport data={charts.servicosStatus} />
                  )}
                </Card>
                <Card>
                  <CardHeader title="Valor por Tipo de Servico" />
                  {charts.servicosTipo.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem servicos no periodo" />
                  ) : (
                    <BarCompareReport data={charts.servicosTipo} />
                  )}
                </Card>
              </div>

              {metrics.servicoValorTotal > 0 && (
                <Card>
                  <CardHeader title="Resultado dos Servicos" />
                  <BarCompareReport
                    data={[
                      { name: 'Valor', value: metrics.servicoValorTotal },
                      { name: 'Recebido', value: metrics.servicoRecebido },
                      { name: 'A receber', value: metrics.servicosAbertoValor },
                      { name: 'Custos', value: metrics.servicoSaidas },
                      { name: 'Lucro', value: metrics.servicoLucro },
                    ]}
                  />
                </Card>
              )}
            </ReportBlock>
          )}

          {activeSection === 'estoque' && (
            <ReportBlock>
              <SectionTitle title="Estoque" subtitle="Movimentacoes do periodo, situacao atual e retorno potencial por produto" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Entradas no Estoque" value={`${metrics.estoqueEntradas} un`} changeType="up" />
                <MetricCard label="Saidas do Estoque" value={`${metrics.estoqueSaidas} un`} changeType="down" />
                <MetricCard label="Saldo do Periodo" value={`${metrics.estoqueSaldo} un`} changeType={metrics.estoqueSaldo >= 0 ? 'up' : 'down'} />
                <MetricCard label="Alertas Atuais" value={String(estoqueAtual.alertas)} changeType={estoqueAtual.alertas > 0 ? 'down' : 'neutral'} accent={estoqueAtual.alertas > 0} />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Investido" value={formatMoney(investimentoData.totalInvestido)} changeType="neutral" />
                <MetricCard label="Retorno Total" value={formatMoney(investimentoData.totalRetorno)} changeType="up" accent />
                <MetricCard label="Arrecadado no Periodo" value={formatMoney(investimentoData.totalVendido)} changeType="up" />
                <MetricCard label="Realizado" value={`${investimentoData.pctRealizado.toFixed(0)}%`} changeType={investimentoData.pctRealizado >= 50 ? 'up' : 'neutral'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader title="Movimentacoes por Categoria" />
                  {charts.estoqueCategoria.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem movimentacoes no periodo" />
                  ) : (
                    <BarCompareReport data={charts.estoqueCategoria} unit=" un" />
                  )}
                </Card>
                <Card>
                  <CardHeader title="Resumo Atual do Estoque" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <MetricCard label="Unidades" value={`${estoqueAtual.unidades} un`} changeType="neutral" />
                    <MetricCard label="Variacoes em Alerta" value={String(estoqueAtual.alertas)} changeType={estoqueAtual.alertas > 0 ? 'down' : 'neutral'} />
                    <MetricCard label="Produtos em Alerta" value={String(estoqueAtual.produtosCriticos)} changeType={estoqueAtual.produtosCriticos > 0 ? 'down' : 'neutral'} />
                  </div>
                </Card>
              </div>

              <Card padding="none">
                <div className="p-5 border-b border-gold-100">
                  <h3 className="text-sm font-semibold text-dark-700">Investimento vs Retorno Potencial por Produto</h3>
                  <p className="text-xs text-dark-400 mt-0.5">Custo atual em estoque, potencial de venda e progresso de conversão no período</p>
                </div>

                {investimentoData.produtos.length === 0 ? (
                  <div className="p-6">
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Nenhum produto com dados de investimento" />
                  </div>
                ) : (
                  <div className="divide-y divide-gold-50">
                    {investimentoData.produtos.map((p) => {
                      const margemColor = p.margem_potencial >= 60
                        ? 'bg-green-100 text-green-700'
                        : p.margem_potencial >= 30
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-red-100 text-red-700'
                      const tudo_vendido = p.estoque_qtd === 0 && p.vendido_qtd > 0

                      return (
                        <div key={p.produto_id} className="p-4 sm:p-5 hover:bg-cream-50/30 transition-colors">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-dark-700 text-sm leading-tight">{p.produto_nome}</p>
                              <p className="text-xs text-dark-300 mt-0.5">{PRODUTO_CATEGORIA_LABEL[p.categoria] ?? p.categoria}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {tudo_vendido && (
                                <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                  ✓ Tudo vendido
                                </span>
                              )}
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${margemColor}`}>
                                +{p.margem_potencial.toFixed(0)}% margem
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="rounded-xl border border-gold-100 bg-cream-50 p-3 text-center">
                              <p className="text-[10px] font-medium text-dark-300 uppercase tracking-wide mb-1">Total Investido</p>
                              <p className="text-sm font-bold text-dark-700">{formatMoney(p.investido)}</p>
                              {p.custo_vendido > 0 && (
                                <p className="text-[10px] text-dark-300 mt-0.5">
                                  {formatMoney(p.custo_estoque)} estoque<br />
                                  + {formatMoney(p.custo_vendido)} vendido
                                </p>
                              )}
                              {p.custo_vendido === 0 && (
                                <p className="text-[10px] text-dark-300 mt-0.5">{p.estoque_qtd} un em estoque</p>
                              )}
                            </div>
                            <div className="rounded-xl border border-gold-300 bg-gold-50 p-3 text-center">
                              <p className="text-[10px] font-medium text-dark-300 uppercase tracking-wide mb-1">Retorno Total</p>
                              <p className="text-sm font-bold text-gold-700">{formatMoney(p.retorno_total)}</p>
                              {p.vendido_valor > 0 && (
                                <p className="text-[10px] text-dark-300 mt-0.5">
                                  {formatMoney(p.vendido_valor)} recebido<br />
                                  + {formatMoney(p.potencial)} restante
                                </p>
                              )}
                              {p.vendido_valor === 0 && (
                                <p className="text-[10px] text-dark-300 mt-0.5">se vender tudo</p>
                              )}
                            </div>
                            <div className={`rounded-xl border p-3 text-center ${p.vendido_valor > 0 ? 'border-green-200 bg-green-50' : 'border-gold-100 bg-cream-50'}`}>
                              <p className="text-[10px] font-medium text-dark-300 uppercase tracking-wide mb-1">Arrecadado</p>
                              <p className={`text-sm font-bold ${p.vendido_valor > 0 ? 'text-green-700' : 'text-dark-400'}`}>
                                {p.vendido_valor > 0 ? formatMoney(p.vendido_valor) : '—'}
                              </p>
                              <p className="text-[10px] text-dark-300 mt-0.5">no período</p>
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs text-dark-400 mb-1.5">
                              <span>
                                <span className="font-medium text-gold-600">{p.vendido_qtd}</span>
                                <span className="text-dark-300"> vendida(s)</span>
                              </span>
                              <span>
                                <span className="font-medium text-dark-600">{p.estoque_qtd}</span>
                                <span className="text-dark-300"> em estoque</span>
                              </span>
                            </div>
                            <div className="h-2.5 bg-cream-200 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, p.pct_vendido)}%`,
                                  background: tudo_vendido
                                    ? '#16a34a'
                                    : 'linear-gradient(90deg, #B8962E, #D4AF5A)',
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-xs mt-1">
                              <span className={`font-medium ${tudo_vendido ? 'text-green-600' : 'text-gold-600'}`}>
                                {p.pct_vendido.toFixed(0)}% convertido
                              </span>
                              {p.total_qtd > 0 && !tudo_vendido && (
                                <span className="text-dark-300">
                                  faltam {p.estoque_qtd} un · {formatMoney(p.potencial)} a receber
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Card>
            </ReportBlock>
          )}

          {activeSection === 'crediario' && (
            <ReportBlock>
              <SectionTitle title="Crediario" subtitle="Parcelas recebidas e valores com vencimento no periodo" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Recebido" value={formatMoney(metrics.crediarioRecebido)} changeType="up" />
                <MetricCard label="A Receber" value={formatMoney(metrics.crediarioAVencer)} changeType="neutral" />
                <MetricCard label="Parcelas no Periodo" value={String(metrics.crediarioParcelas)} changeType="neutral" />
                <MetricCard label="Saldo Projetado" value={formatMoney(metrics.crediarioRecebido - metrics.crediarioAVencer)} changeType={metrics.crediarioRecebido >= metrics.crediarioAVencer ? 'up' : 'down'} />
              </div>
            </ReportBlock>
          )}
        </>
      )}
    </div>
  )
}

function PieReport({ data, offset = 0 }: { data: CategoriaData[]; offset?: number }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[(index + offset) % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
        <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#6B5B45' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function BarCompareReport({ data, unit = '' }: { data: { name: string; value: number }[]; unit?: string }) {
  if (data.every((item) => item.value === 0)) {
    return <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem dados no periodo" />
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => unit ? `${value}${unit}` : numberFormat(value)} />
        <Tooltip formatter={(value) => unit ? [`${Number(value)}${unit}`, 'Total'] : [formatMoney(Number(value)), 'Total']} contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
        <Bar dataKey="value" fill="#B8962E" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
