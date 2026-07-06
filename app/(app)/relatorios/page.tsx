'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, CardHeader, MetricCard, Spinner, EmptyState,
  PeriodFilter, getPeriodRange, Button, Pagination, SearchInput, Badge, Select, Modal, type PeriodPreset,
} from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { formatMoney, formatDate, FORMA_PAGAMENTO_LABEL, PRODUTO_CATEGORIA_LABEL, SERVICO_STATUS_LABEL, today } from '@/utils'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import type { EstoqueMovimentoTipo, ProdutoCategoria, VwEstoqueAtual, ServicoStatus, ContaPagar } from '@/types'
import { listarContasPagar } from '@/services/contas-pagar'

const CHART_COLORS = ['#B8962E', '#C49A35', '#D4AF5A', '#EBD9A4', '#9A7B22', '#7A5C10', '#5C4208', '#3D2B05']

type ReportSection = 'geral' | 'vendas' | 'caixa' | 'servicos' | 'estoque' | 'crediario' | 'leads' | 'contas' | 'clientes'
type CaixaChartMode = 'evolucao' | 'categorias' | 'lancamentos'
type VendasSubTab = 'todas' | 'normal' | 'livre'

const REPORT_SECTIONS: { key: ReportSection; label: string; subtitle: string }[] = [
  { key: 'geral', label: 'Visão Geral', subtitle: 'Saúde da empresa' },
  { key: 'vendas', label: 'Vendas', subtitle: 'Faturamento e lucro' },
  { key: 'caixa', label: 'Despesas e Caixa', subtitle: 'Entradas e saidas' },
  { key: 'servicos', label: 'Servicos', subtitle: 'Ordens e receita' },
  { key: 'estoque', label: 'Estoque', subtitle: 'Movimentacoes e alertas' },
  { key: 'crediario', label: 'Crediario', subtitle: 'Parcelas e recebimentos' },
  { key: 'leads', label: 'Leads', subtitle: 'Origem de clientes' },
  { key: 'contas', label: 'Contas a Pagar', subtitle: 'Vencimentos e pagamentos' },
  { key: 'clientes', label: 'Clientes', subtitle: 'LTV e top compradores' },
]

interface CategoriaData { name: string; value: number }
interface SerieData { periodo: string; entradas: number; despesas: number }

interface OrigemCliente {
  id: string
  nome: string
  ativo: boolean
}

interface VendaRelatorio {
  id: string
  tipo: 'normal' | 'livre'
  total: number
  data_venda: string
  forma_pagamento: string
  vendedor_id: string | null
  cliente_id: string | null
  descricao_livre: string | null
  custo_livre: number | null
  origem_id: string | null
  origem_outro: string | null
  itens?: {
    produto_id: string | null
    subtotal: number
    custo_unitario: number
    quantidade: number
    nome_produto: string
    produto?: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null
  }[] | null
  vendedor?: { nome: string } | { nome: string }[] | null
  cliente?: { nome: string; telefone: string | null } | { nome: string; telefone: string | null }[] | null
}

interface VendaLtvRow {
  cliente_id: string | null
  total: number
  data_venda: string
}

interface ClienteCadastro {
  id: string
  nome: string
  telefone: string | null
  ativo: boolean
}

type ClienteLtvStatus = 'ativo' | 'inativo'

interface ClienteLtvStats {
  id: string
  nome: string
  telefone: string | null
  compras: number
  ltvTotal: number
  ticketMedio: number | null
  primeiraCompra: string | null
  ultimaCompra: string | null
  tempoVidaDias: number | null
  recenciaDias: number | null
  frequenciaMensal: number | null
  status: ClienteLtvStatus
}

interface LancamentoRelatorio {
  tipo: 'entrada' | 'saida'
  descricao: string | null
  valor: number
  data_lancamento: string
  forma_pagamento: string | null
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
  origem_id: string | null
  origem_outro: string | null
}

interface MovimentoEstoqueRelatorio {
  tipo: EstoqueMovimentoTipo
  quantidade: number
  created_at: string
  produto?: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null
}

interface CrediarioRow {
  venda_id: string
  total: number
  entrada: number
  saldo: number
  parcelas?: { valor_pago: number; status: string }[] | null
}

interface CrediarioParcelaPaga {
  valor_pago: number
  crediario?: {
    venda?: VendaRelatorio | VendaRelatorio[] | null
  } | {
    venda?: VendaRelatorio | VendaRelatorio[] | null
  }[] | null
}

function formatFrequenciaCompra(frequenciaMensal: number | null): string {
  if (frequenciaMensal === null || frequenciaMensal <= 0) return '—'
  const intervaloDias = Math.round(30.44 / frequenciaMensal)
  return `a cada ${intervaloDias} dia${intervaloDias !== 1 ? 's' : ''}`
}

function healthClass(good: boolean, warn: boolean) {
  if (good) return { card: 'border-green-200 bg-green-50/60', badge: 'text-green-700 bg-green-100', label: 'Saudável' }
  if (warn) return { card: 'border-amber-200 bg-amber-50/60', badge: 'text-amber-700 bg-amber-100', label: 'Atenção' }
  return { card: 'border-red-200 bg-red-50/50', badge: 'text-red-700 bg-red-100', label: 'Crítico' }
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

function getParcelaVenda(parcela: CrediarioParcelaPaga) {
  const crediario = Array.isArray(parcela.crediario) ? parcela.crediario[0] : parcela.crediario
  const venda = crediario?.venda
  return Array.isArray(venda) ? venda[0] : venda
}

function getVendaVendedorNome(venda: VendaRelatorio) {
  const vendedor = Array.isArray(venda.vendedor) ? venda.vendedor[0] : venda.vendedor
  return vendedor?.nome ?? 'Sem vendedor'
}

function getFormaPagamentoLabel(forma: string) {
  return FORMA_PAGAMENTO_LABEL[forma as keyof typeof FORMA_PAGAMENTO_LABEL] ?? forma
}

function getVendaCusto(venda: VendaRelatorio) {
  if (venda.tipo === 'livre') return venda.custo_livre ?? 0
  return (venda.itens ?? []).reduce((sum, item) => sum + ((item.custo_unitario ?? 0) * (item.quantidade ?? 0)), 0)
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
  const [activeSection, setActiveSection] = useState<ReportSection>('geral')
  const [caixaChartMode, setCaixaChartMode] = useState<CaixaChartMode>('evolucao')
  const [vendasSubTab, setVendasSubTab] = useState<VendasSubTab>('todas')
  const [vendedorFiltro, setVendedorFiltro] = useState('todos')
  const [combinarTipos, setCombinarTipos] = useState(false)
  const [loading, setLoading] = useState(true)

  const [vendas, setVendas] = useState<VendaRelatorio[]>([])
  const [lancamentos, setLancamentos] = useState<LancamentoRelatorio[]>([])
  const [servicos, setServicos] = useState<ServicoRelatorio[]>([])
  const [movimentosEstoque, setMovimentosEstoque] = useState<MovimentoEstoqueRelatorio[]>([])
  const [crediariosData, setCrediariosData] = useState<CrediarioRow[]>([])
  const [crediarioParcelasPagas, setCrediarioParcelasPagas] = useState<CrediarioParcelaPaga[]>([])
  const [estoqueAtual, setEstoqueAtual] = useState({ unidades: 0, alertas: 0, produtosCriticos: 0 })
  const [estoqueDetalhado, setEstoqueDetalhado] = useState<VwEstoqueAtual[]>([])
  const [origensCliente, setOrigensCliente] = useState<OrigemCliente[]>([])
  const [contasPagar, setContasPagar] = useState<ContaPagar[]>([])
  const [clienteLtvData, setClienteLtvData] = useState<VendaLtvRow[]>([])
  const [todosClientes, setTodosClientes] = useState<ClienteCadastro[]>([])
  const [clienteSearch, setClienteSearch] = useState('')
  const [ltvStatusFiltro, setLtvStatusFiltro] = useState<'todos' | ClienteLtvStatus>('todos')
  const [ltvInatividadeDias, setLtvInatividadeDias] = useState(90)
  const [ltvSortField, setLtvSortField] = useState<keyof ClienteLtvStats>('ltvTotal')
  const [ltvSortDir, setLtvSortDir] = useState<'asc' | 'desc'>('desc')
  const [clienteLtvDetalhe, setClienteLtvDetalhe] = useState<ClienteLtvStats | null>(null)

  const loadRelatorios = useCallback(async () => {
    setLoading(true)
    const inicioCompleto = `${dataInicio}T00:00:00`
    const fimCompleto = `${dataFim}T23:59:59`

    const [vendasResult, lancamentosResult, servicosResult, movimentosResult, crediariosResult, parcelasResult, estoqueResult, origensResult, ltvResult, clientesResult] = await Promise.all([
      supabase
        .from('vendas')
        .select('id, tipo, total, data_venda, forma_pagamento, vendedor_id, cliente_id, descricao_livre, custo_livre, origem_id, origem_outro, vendedor:profiles(nome), cliente:clientes(nome, telefone), itens:venda_itens(produto_id, nome_produto, subtotal, custo_unitario, quantidade, produto:produtos(categoria))')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .not('status', 'eq', 'cancelado'),
      supabase
        .from('lancamentos')
        .select('tipo, descricao, valor, data_lancamento, forma_pagamento, categoria_nome, referencia_tipo')
        .gte('data_lancamento', dataInicio)
        .lte('data_lancamento', dataFim),
      supabase
        .from('servicos')
        .select('status, tipo, valor, custo_estimado, pago, data_entrada, origem_id, origem_outro')
        .gte('data_entrada', dataInicio)
        .lte('data_entrada', dataFim),
      supabase
        .from('estoque_movimentacoes')
        .select('tipo, quantidade, created_at, produto:produtos(categoria)')
        .gte('created_at', inicioCompleto)
        .lte('created_at', fimCompleto),
      supabase
        .from('crediario')
        .select('venda_id, total, entrada, saldo, parcelas:crediario_parcelas(valor_pago, status)')
        .not('status', 'eq', 'cancelado'),
      supabase
        .from('crediario_parcelas')
        .select('valor_pago, crediario:crediario(venda:vendas(id, tipo, total, data_venda, forma_pagamento, vendedor_id, descricao_livre, custo_livre, vendedor:profiles(nome), itens:venda_itens(produto_id, nome_produto, subtotal, custo_unitario, quantidade, produto:produtos(categoria))))')
        .eq('status', 'pago')
        .gte('data_pagamento', dataInicio)
        .lte('data_pagamento', dataFim),
      supabase
        .from('vw_estoque_atual')
        .select('produto_id, produto_nome, categoria, custo, preco_venda, estoque_atual, status_estoque'),
      supabase
        .from('origens_cliente')
        .select('id, nome, ativo')
        .eq('ativo', true),
      supabase
        .from('vendas')
        .select('cliente_id, total, data_venda')
        .not('status', 'eq', 'cancelado')
        .not('cliente_id', 'is', null),
      supabase
        .from('clientes')
        .select('id, nome, telefone, ativo'),
    ])

    setVendas(((vendasResult.data ?? []) as unknown) as VendaRelatorio[])
    setLancamentos((lancamentosResult.data as LancamentoRelatorio[]) ?? [])
    setServicos((servicosResult.data as ServicoRelatorio[]) ?? [])
    setMovimentosEstoque(((movimentosResult.data ?? []) as unknown) as MovimentoEstoqueRelatorio[])
    setCrediariosData(((crediariosResult.data ?? []) as unknown) as CrediarioRow[])
    setCrediarioParcelasPagas(((parcelasResult.data ?? []) as unknown) as CrediarioParcelaPaga[])
    setOrigensCliente((origensResult.data ?? []) as OrigemCliente[])
    setClienteLtvData(((ltvResult.data ?? []) as unknown) as VendaLtvRow[])
    setTodosClientes((clientesResult.data ?? []) as ClienteCadastro[])

    const { data: contasData } = await listarContasPagar()
    setContasPagar(contasData)

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
    const vendasRecebidas = vendas.filter((venda) => venda.forma_pagamento !== 'crediario')
    const lancamentosFinanceiros = lancamentos
    const vendaIdsNoPeriodo = new Set(vendas.map((v) => v.id))
    const crediariosNoPeriodo = crediariosData.filter((c) => vendaIdsNoPeriodo.has(c.venda_id))
    const crediarioParcPagas = crediarioParcelasPagas.reduce((s, p) => s + (p.valor_pago ?? 0), 0)

    const recebidoPorVendaCrediario = new Map<string, { venda: VendaRelatorio | null; valor: number }>()
    crediariosNoPeriodo.forEach((crediario) => {
      const venda = vendas.find((v) => v.id === crediario.venda_id) ?? null
      const current = recebidoPorVendaCrediario.get(crediario.venda_id) ?? { venda, valor: 0 }
      current.valor += crediario.entrada ?? 0
      if (!current.venda) current.venda = venda
      recebidoPorVendaCrediario.set(crediario.venda_id, current)
    })
    crediarioParcelasPagas.forEach((parcela) => {
      const venda = getParcelaVenda(parcela)
      if (!venda) return
      const current = recebidoPorVendaCrediario.get(venda.id) ?? { venda, valor: 0 }
      current.valor += parcela.valor_pago ?? 0
      current.venda = venda
      recebidoPorVendaCrediario.set(venda.id, current)
    })

    const crediarioRecebidoComoVenda = Array.from(recebidoPorVendaCrediario.values())
      .reduce((sum, item) => sum + item.valor, 0)
    const faturamento = vendasRecebidas.reduce((sum, venda) => sum + (venda.total ?? 0), 0) + crediarioRecebidoComoVenda
    const custoVendasRecebidas = vendasRecebidas.reduce((sum, venda) => sum + getVendaCusto(venda), 0)
    const custoCrediarioRecebido = Array.from(recebidoPorVendaCrediario.values()).reduce((sum, item) => {
      if (!item.venda || item.venda.total <= 0) return sum
      return sum + (getVendaCusto(item.venda) * Math.min(1, item.valor / item.venda.total))
    }, 0)
    const custo = custoVendasRecebidas + custoCrediarioRecebido
    const despesas = lancamentosFinanceiros.filter((item) => item.tipo === 'saida').reduce((sum, item) => sum + item.valor, 0)
    const entradas = lancamentosFinanceiros.filter((item) => item.tipo === 'entrada').reduce((sum, item) => sum + item.valor, 0)

    const servicosAtivos = servicos.filter((s) => s.status !== 'cancelado')
    const servicoValorTotal = servicosAtivos.reduce((sum, s) => sum + (s.valor ?? 0), 0)
    const servicoRecebido = servicosAtivos.filter((s) => s.pago).reduce((sum, s) => sum + (s.valor ?? 0), 0)
    const servicoSaidas = servicosAtivos.reduce((sum, s) => sum + (s.custo_estimado ?? 0), 0)
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

    const crediarioEntradaNoPeriodo = crediariosNoPeriodo.reduce((sum, c) => sum + (c.entrada ?? 0), 0)
    const crediarioRecebido = crediarioEntradaNoPeriodo + crediarioParcPagas

    const crediarioAVencer = crediariosNoPeriodo.reduce((sum, c) => {
      const pagas = Array.isArray(c.parcelas) ? c.parcelas : []
      const totalPagoCrediario = pagas.filter((p) => p.status === 'pago').reduce((s, p) => s + (p.valor_pago ?? 0), 0)
      return sum + Math.max(0, c.total - c.entrada - totalPagoCrediario)
    }, 0)

    return {
      faturamento,
      lucroBruto: faturamento - custo,
      lucroLiquido: faturamento - custo - despesas,
      despesas,
      entradas,
      ticketMedio: vendasRecebidas.length + recebidoPorVendaCrediario.size > 0
        ? faturamento / (vendasRecebidas.length + recebidoPorVendaCrediario.size)
        : 0,
      vendasQtd: vendasRecebidas.length + recebidoPorVendaCrediario.size,
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
      crediarioParcelas: crediariosNoPeriodo.length,
    }
  }, [lancamentos, movimentosEstoque, crediariosData, crediarioParcelasPagas, servicos, vendas])

  const contasMetrics = useMemo(() => {
    const todayStr = today()

    const pendentes = contasPagar.filter(c => c.status === 'pendente')
    const vencidas = pendentes.filter(c => c.data_vencimento < todayStr)
    const pagas = contasPagar.filter(c => c.status === 'pago')
    const pagasNoPeriodo = pagas.filter(c => c.data_pagamento && c.data_pagamento >= dataInicio && c.data_pagamento <= dataFim)
    const fixas = contasPagar.filter(c => c.fixa && c.status !== 'cancelado')
    const variaveis = contasPagar.filter(c => !c.fixa && c.status !== 'cancelado')

    const byMes: Record<string, { pendente: number; pago: number }> = {}
    contasPagar.filter(c => c.status !== 'cancelado').forEach(c => {
      const mes = c.data_vencimento.slice(0, 7)
      byMes[mes] ??= { pendente: 0, pago: 0 }
      if (c.status === 'pago') byMes[mes].pago += c.valor
      else byMes[mes].pendente += c.valor
    })
    const evolucao = Object.entries(byMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, vals]) => {
        const [y, m] = mes.split('-')
        return { periodo: `${m}/${y.slice(2)}`, ...vals }
      })

    return {
      totalPendente: pendentes.reduce((s, c) => s + c.valor, 0),
      qtdVencidas: vencidas.length,
      valorVencido: vencidas.reduce((s, c) => s + c.valor, 0),
      totalPagasNoPeriodo: pagasNoPeriodo.reduce((s, c) => s + c.valor, 0),
      qtdPagasNoPeriodo: pagasNoPeriodo.length,
      totalFixas: fixas.reduce((s, c) => s + c.valor, 0),
      totalVariaveis: variaveis.reduce((s, c) => s + c.valor, 0),
      qtdFixas: fixas.length,
      qtdVariaveis: variaveis.length,
      vencidas,
      pendentes,
      pagasNoPeriodo,
      evolucao,
    }
  }, [contasPagar, dataInicio, dataFim])

  const charts = useMemo(() => {
    const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45
    const serieMap: Record<string, SerieData> = {}
    const vendasRecebidas = vendas.filter((venda) => venda.forma_pagamento !== 'crediario')
    const lancamentosFinanceiros = lancamentos
    const vendaIdsNoPeriodo = new Set(vendas.map((v) => v.id))
    const recebidoPorVendaCrediario = new Map<string, { venda: VendaRelatorio | null; valor: number }>()

    crediariosData
      .filter((crediario) => vendaIdsNoPeriodo.has(crediario.venda_id))
      .forEach((crediario) => {
        const venda = vendas.find((v) => v.id === crediario.venda_id) ?? null
        const current = recebidoPorVendaCrediario.get(crediario.venda_id) ?? { venda, valor: 0 }
        current.valor += crediario.entrada ?? 0
        if (!current.venda) current.venda = venda
        recebidoPorVendaCrediario.set(crediario.venda_id, current)
      })
    crediarioParcelasPagas.forEach((parcela) => {
      const venda = getParcelaVenda(parcela)
      if (!venda) return
      const current = recebidoPorVendaCrediario.get(venda.id) ?? { venda, valor: 0 }
      current.valor += parcela.valor_pago ?? 0
      current.venda = venda
      recebidoPorVendaCrediario.set(venda.id, current)
    })

    lancamentosFinanceiros.forEach((item) => {
      const key = periodKey(item.data_lancamento, useDay)
      serieMap[key] ??= { periodo: key, entradas: 0, despesas: 0 }
      if (item.tipo === 'entrada') serieMap[key].entradas += item.valor
      if (item.tipo === 'saida') serieMap[key].despesas += item.valor
    })

    const vendasProduto: Record<string, number> = {}
    const addVendaProduto = (venda: VendaRelatorio, valorRecebido: number) => {
      if (valorRecebido <= 0) return
      if (venda.tipo === 'livre') {
        const label = venda.descricao_livre || 'Venda Livre'
        vendasProduto[label] = (vendasProduto[label] ?? 0) + valorRecebido
      } else {
        const totalItens = (venda.itens ?? []).reduce((sum, item) => sum + (item.subtotal ?? 0), 0)
        ;(venda.itens ?? []).forEach((item) => {
          const label = item.nome_produto || 'Produto sem nome'
          const proporcao = totalItens > 0 ? (item.subtotal ?? 0) / totalItens : 0
          vendasProduto[label] = (vendasProduto[label] ?? 0) + valorRecebido * proporcao
        })
      }
    }
    vendasRecebidas.forEach((venda) => addVendaProduto(venda, venda.total ?? 0))
    Array.from(recebidoPorVendaCrediario.values()).forEach((item) => {
      if (item.venda) addVendaProduto(item.venda, item.valor)
    })

    const despesasCat: Record<string, number> = {}
    lancamentosFinanceiros.filter((item) => item.tipo === 'saida').forEach((item) => {
      const label = item.categoria_nome ?? 'Outros'
      despesasCat[label] = (despesasCat[label] ?? 0) + item.valor
    })

    const lancamentosMap: Record<string, number> = {}
    lancamentosFinanceiros.forEach((item) => {
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
  }, [dataFim, dataInicio, lancamentos, movimentosEstoque, crediariosData, crediarioParcelasPagas, servicos, vendas])

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

  const saudeFinanceira = useMemo(() => {
    const margemBruta = metrics.faturamento > 0 ? (metrics.lucroBruto / metrics.faturamento) * 100 : 0
    const margemLiquida = metrics.entradas > 0 ? ((metrics.entradas - metrics.despesas) / metrics.entradas) * 100 : 0
    const totalFaturado = metrics.faturamento + metrics.servicoRecebido
    const crediarioPct = totalFaturado > 0 ? (metrics.crediarioAVencer / totalFaturado) * 100 : 0
    const servicosPct = metrics.servicoValorTotal > 0 ? (metrics.servicoRecebido / metrics.servicoValorTotal) * 100 : 100
    return {
      margemBruta,
      margemLiquida,
      crediarioPct,
      servicosPct,
      totalFaturado,
      saudeMargemBruta: healthClass(margemBruta >= 40, margemBruta >= 20),
      saudeMargemLiquida: healthClass(margemLiquida >= 20, margemLiquida >= 10),
      saudeCrediario: healthClass(crediarioPct <= 20, crediarioPct <= 40),
      saudeServicos: healthClass(servicosPct >= 80, servicosPct >= 50),
    }
  }, [metrics])

  const vendasPorTipo = useMemo(() => {
    const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45

    const vendasNormal = vendas.filter((v) => v.tipo === 'normal')
    const vendasLivre = vendas.filter((v) => v.tipo === 'livre')

    const normalRecebidas = vendasNormal.filter((v) => v.forma_pagamento !== 'crediario')
    const livreRecebidas = vendasLivre.filter((v) => v.forma_pagamento !== 'crediario')

    const faturamentoNormal = normalRecebidas.reduce((sum, v) => sum + (v.total ?? 0), 0)
    const faturamentoLivre = livreRecebidas.reduce((sum, v) => sum + (v.total ?? 0), 0)

    const livreCrediaridas = vendasLivre.filter((v) => v.forma_pagamento === 'crediario')
    const livreAVista = vendasLivre.filter((v) => v.forma_pagamento !== 'crediario')
    const livreCrediariadoValor = livreCrediaridas.reduce((sum, v) => sum + (v.total ?? 0), 0)
    const livreAVistaValor = livreAVista.reduce((sum, v) => sum + (v.total ?? 0), 0)

    // Side-by-side por período
    const tipoSerieMap: Record<string, { periodo: string; normal: number; livre: number }> = {}
    ;[...vendasNormal, ...vendasLivre].forEach((v) => {
      const key = periodKey(v.data_venda, useDay)
      tipoSerieMap[key] ??= { periodo: key, normal: 0, livre: 0 }
    })
    vendasNormal.forEach((v) => { tipoSerieMap[periodKey(v.data_venda, useDay)].normal += v.total ?? 0 })
    vendasLivre.forEach((v) => { tipoSerieMap[periodKey(v.data_venda, useDay)].livre += v.total ?? 0 })

    const livreByDescricao: Record<string, number> = {}
    vendasLivre.forEach((v) => {
      const label = v.descricao_livre || 'Venda Livre'
      livreByDescricao[label] = (livreByDescricao[label] ?? 0) + (v.total ?? 0)
    })

    const custoNormal = vendasNormal.reduce((sum, v) => sum + getVendaCusto(v), 0)
    const custoLivre = vendasLivre.reduce((sum, v) => sum + getVendaCusto(v), 0)

    return {
      faturamentoNormal,
      faturamentoLivre,
      qtdNormal: vendasNormal.length,
      qtdLivre: vendasLivre.length,
      livreCrediariadoValor,
      livreAVistaValor,
      livreCrediariadasQtd: livreCrediaridas.length,
      livreAVistaQtd: livreAVista.length,
      tipoSerie: Object.values(tipoSerieMap),
      tickMedioNormal: normalRecebidas.length > 0 ? faturamentoNormal / normalRecebidas.length : 0,
      tickMedioLivre: livreRecebidas.length > 0 ? faturamentoLivre / livreRecebidas.length : 0,
      lucroNormal: faturamentoNormal - custoNormal,
      lucroLivre: faturamentoLivre - custoLivre,
      livreByDescricao,
    }
  }, [vendas, dataFim, dataInicio])

  const vendasEquipe = useMemo(() => {
    const vendasBase = vendasSubTab === 'normal'
      ? vendas.filter((venda) => venda.tipo === 'normal')
      : vendasSubTab === 'livre'
        ? vendas.filter((venda) => venda.tipo === 'livre')
        : vendas
    const vendedorOptionsMap = new Map<string, string>()
    vendasBase.forEach((venda) => {
      vendedorOptionsMap.set(venda.vendedor_id ?? 'sem-vendedor', getVendaVendedorNome(venda))
    })

    const vendasFiltradas = vendedorFiltro === 'todos'
      ? vendasBase
      : vendasBase.filter((venda) => (venda.vendedor_id ?? 'sem-vendedor') === vendedorFiltro)

    const rankingMap = new Map<string, {
      id: string
      nome: string
      total: number
      quantidade: number
      ticketMedio: number
    }>()

    vendasFiltradas.forEach((venda) => {
      const id = venda.vendedor_id ?? 'sem-vendedor'
      const current = rankingMap.get(id) ?? {
        id,
        nome: getVendaVendedorNome(venda),
        total: 0,
        quantidade: 0,
        ticketMedio: 0,
      }
      current.total += venda.total ?? 0
      current.quantidade += 1
      current.ticketMedio = current.quantidade > 0 ? current.total / current.quantidade : 0
      rankingMap.set(id, current)
    })

    const totalFiltrado = vendasFiltradas.reduce((sum, venda) => sum + (venda.total ?? 0), 0)
    const formasMap = new Map<string, { forma: string; label: string; total: number; quantidade: number; pct: number }>()

    vendasFiltradas.forEach((venda) => {
      const forma = venda.forma_pagamento || 'nao_informado'
      const current = formasMap.get(forma) ?? {
        forma,
        label: getFormaPagamentoLabel(forma),
        total: 0,
        quantidade: 0,
        pct: 0,
      }
      current.total += venda.total ?? 0
      current.quantidade += 1
      current.pct = totalFiltrado > 0 ? (current.total / totalFiltrado) * 100 : 0
      formasMap.set(forma, current)
    })

    return {
      vendedores: Array.from(vendedorOptionsMap.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
      ranking: Array.from(rankingMap.values()).sort((a, b) => b.total - a.total),
      formasPagamento: Array.from(formasMap.values()).sort((a, b) => b.total - a.total),
      total: totalFiltrado,
      quantidade: vendasFiltradas.length,
    }
  }, [vendasSubTab, vendedorFiltro, vendas])

  const vendedorRankingSelecionado = vendedorFiltro === 'todos'
    ? 'Todos os vendedores'
    : vendasEquipe.vendedores.find((vendedor) => vendedor.id === vendedorFiltro)?.nome ?? 'Todos os vendedores'

  const searchVendedoresRanking = useCallback(async (q: string): Promise<SelectOption[]> => {
    const term = q.trim().toLowerCase()
    const options = [
      { id: 'todos', label: 'Todos os vendedores', sublabel: 'Ranking geral' },
      ...vendasEquipe.vendedores.map((vendedor) => ({
        id: vendedor.id,
        label: vendedor.nome,
        sublabel: vendedor.id === 'sem-vendedor' ? 'Sem vendedor' : 'Vendedor',
      })),
    ]
    return options.filter((option) => !term || option.label.toLowerCase().includes(term))
  }, [vendasEquipe.vendedores])

  const analiseLeads = useMemo(() => {
    const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 45
    const origemById = new Map(origensCliente.map((o) => [o.id, o.nome]))

    const origemCount: Record<string, { nome: string; count: number; valor: number }> = {}

    const processOrigem = (origemId: string | null, origemOutro: string | null, valor: number) => {
      let nome: string | null = null
      if (origemId) nome = origemById.get(origemId) ?? 'Desconhecida'
      else if (origemOutro) nome = origemOutro
      if (!nome) return
      origemCount[nome] ??= { nome, count: 0, valor: 0 }
      origemCount[nome].count += 1
      origemCount[nome].valor += valor
    }

    vendas.forEach((v) => processOrigem(v.origem_id, v.origem_outro, v.total ?? 0))
    servicos.forEach((s) => processOrigem(s.origem_id, s.origem_outro, s.valor ?? 0))

    const total = Object.values(origemCount).reduce((sum, o) => sum + o.count, 0)
    const ranking = Object.values(origemCount)
      .sort((a, b) => b.count - a.count)
      .map((o, i) => ({ ...o, posicao: i + 1, pct: total > 0 ? (o.count / total) * 100 : 0 }))

    // Timeline por período
    const timelineMap: Record<string, Record<string, number>> = {}
    const allOrigens = new Set<string>()

    const addToTimeline = (origemId: string | null, origemOutro: string | null, data: string) => {
      let nome: string | null = null
      if (origemId) nome = origemById.get(origemId) ?? null
      else if (origemOutro) nome = origemOutro
      if (!nome) return
      const period = periodKey(data, useDay)
      timelineMap[period] ??= {}
      timelineMap[period][nome] = (timelineMap[period][nome] ?? 0) + 1
      allOrigens.add(nome)
    }

    vendas.forEach((v) => addToTimeline(v.origem_id, v.origem_outro, v.data_venda))
    servicos.forEach((s) => addToTimeline(s.origem_id, s.origem_outro, s.data_entrada))

    const timeline = Object.entries(timelineMap).map(([periodo, origens]) => ({ periodo, ...origens }))

    return {
      ranking,
      pieData: ranking.map((o) => ({ name: o.nome, value: o.count })),
      timeline,
      allOrigens: ranking.map((o) => o.nome),
      total,
      semOrigem:
        vendas.filter((v) => !v.origem_id && !v.origem_outro).length +
        servicos.filter((s) => !s.origem_id && !s.origem_outro).length,
    }
  }, [vendas, servicos, origensCliente, dataFim, dataInicio])

  const analiseClientes = useMemo(() => {
    const vendasComCliente = vendas.filter((v) => v.cliente_id != null)

    interface ClienteStats {
      id: string
      nome: string
      telefone: string | null
      compras: number
      totalPeriodo: number
      ltvTotal: number
      produtos: Map<string, number>
      vendedores: Map<string, { nome: string; total: number; compras: number }>
    }

    const clienteMap = new Map<string, ClienteStats>()

    vendasComCliente.forEach((venda) => {
      const clienteId = venda.cliente_id!
      const clienteData = Array.isArray(venda.cliente) ? venda.cliente[0] : venda.cliente
      const vendedorData = Array.isArray(venda.vendedor) ? venda.vendedor[0] : venda.vendedor
      const vendedorNome = vendedorData?.nome ?? 'Sem vendedor'
      const vId = venda.vendedor_id ?? 'sem-vendedor'

      let stats = clienteMap.get(clienteId)
      if (!stats) {
        stats = {
          id: clienteId,
          nome: clienteData?.nome ?? 'Cliente',
          telefone: clienteData?.telefone ?? null,
          compras: 0,
          totalPeriodo: 0,
          ltvTotal: 0,
          produtos: new Map(),
          vendedores: new Map(),
        }
        clienteMap.set(clienteId, stats)
      }

      stats.compras += 1
      stats.totalPeriodo += venda.total ?? 0

      if (venda.tipo === 'livre') {
        const label = venda.descricao_livre ?? 'Venda Livre'
        stats.produtos.set(label, (stats.produtos.get(label) ?? 0) + (venda.total ?? 0))
      } else {
        ;(venda.itens ?? []).forEach((item) => {
          const label = item.nome_produto ?? 'Produto'
          stats!.produtos.set(label, (stats!.produtos.get(label) ?? 0) + (item.subtotal ?? 0))
        })
      }

      const vStats = stats.vendedores.get(vId) ?? { nome: vendedorNome, total: 0, compras: 0 }
      vStats.total += venda.total ?? 0
      vStats.compras += 1
      stats.vendedores.set(vId, vStats)
    })

    // LTV all-time: somar todas as vendas históricas por cliente
    clienteLtvData.forEach((row) => {
      if (!row.cliente_id) return
      const stats = clienteMap.get(row.cliente_id)
      if (stats) stats.ltvTotal += row.total ?? 0
    })

    const clientes = Array.from(clienteMap.values()).map((stats) => {
      const vendedoresList = Array.from(stats.vendedores.values()).sort((a, b) => b.total - a.total)
      const produtosList = Array.from(stats.produtos.entries())
        .map(([nome, valor]) => ({ nome, valor }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 3)
      return { ...stats, vendedoresList, produtosList, topVendedor: vendedoresList[0] ?? null }
    }).sort((a, b) => b.totalPeriodo - a.totalPeriodo)

    // Ranking de vendedores: LTV acumulado dos clientes que cada vendedor atendeu
    const vendedorLtvMap = new Map<string, { nome: string; ltvTotal: number; qtdClientes: number }>()
    clientes.forEach((cliente) => {
      cliente.vendedoresList.forEach((v) => {
        const entry = vendedorLtvMap.get(v.nome) ?? { nome: v.nome, ltvTotal: 0, qtdClientes: 0 }
        entry.ltvTotal += cliente.ltvTotal
        entry.qtdClientes += 1
        vendedorLtvMap.set(v.nome, entry)
      })
    })
    const rankingVendedores = Array.from(vendedorLtvMap.values()).sort((a, b) => b.ltvTotal - a.ltvTotal)

    const ltvMedio = clientes.length > 0 ? clientes.reduce((s, c) => s + c.ltvTotal, 0) / clientes.length : 0
    const melhorCliente = clientes[0] ?? null

    return { clientes, rankingVendedores, ltvMedio, melhorCliente }
  }, [vendas, clienteLtvData])

  // LTV completo: TODOS os clientes cadastrados, calculado a partir de todo o histórico de vendas (não filtrado por período)
  const clientesLtv = useMemo(() => {
    const hoje = today()
    const porCliente = new Map<string, { total: number; compras: number; datas: string[] }>()
    clienteLtvData.forEach((row) => {
      if (!row.cliente_id) return
      const entry = porCliente.get(row.cliente_id) ?? { total: 0, compras: 0, datas: [] }
      entry.total += row.total ?? 0
      entry.compras += 1
      entry.datas.push(row.data_venda)
      porCliente.set(row.cliente_id, entry)
    })

    return todosClientes.map((cliente): ClienteLtvStats => {
      const dados = porCliente.get(cliente.id)
      const compras = dados?.compras ?? 0
      const ltvTotal = dados?.total ?? 0

      if (compras === 0 || !dados) {
        return {
          id: cliente.id,
          nome: cliente.nome,
          telefone: cliente.telefone,
          compras: 0,
          ltvTotal: 0,
          ticketMedio: null,
          primeiraCompra: null,
          ultimaCompra: null,
          tempoVidaDias: null,
          recenciaDias: null,
          frequenciaMensal: null,
          status: 'inativo',
        }
      }

      const datasOrdenadas = [...dados.datas].sort()
      const primeiraCompra = datasOrdenadas[0]
      const ultimaCompra = datasOrdenadas[datasOrdenadas.length - 1]
      const tempoVidaDias = differenceInCalendarDays(parseISO(ultimaCompra), parseISO(primeiraCompra))
      const recenciaDias = differenceInCalendarDays(parseISO(hoje), parseISO(ultimaCompra))
      const ticketMedio = ltvTotal / compras
      const status: ClienteLtvStatus = recenciaDias > ltvInatividadeDias ? 'inativo' : 'ativo'
      // Intervalos entre compras = compras - 1 (2 compras = 1 intervalo, não 2)
      const frequenciaMensal = compras > 1 && tempoVidaDias > 0 ? (compras - 1) / (tempoVidaDias / 30.44) : null

      return {
        id: cliente.id,
        nome: cliente.nome,
        telefone: cliente.telefone,
        compras,
        ltvTotal,
        ticketMedio,
        primeiraCompra,
        ultimaCompra,
        tempoVidaDias,
        recenciaDias,
        frequenciaMensal,
        status,
      }
    })
  }, [todosClientes, clienteLtvData, ltvInatividadeDias])

  const clientesLtvResumo = useMemo(() => {
    const comCompra = clientesLtv.filter((c) => c.compras > 0)
    const ativos = clientesLtv.filter((c) => c.status === 'ativo').length
    const somaLtv = comCompra.reduce((s, c) => s + c.ltvTotal, 0)
    const somaCompras = comCompra.reduce((s, c) => s + c.compras, 0)
    const melhorCliente = [...comCompra].sort((a, b) => b.ltvTotal - a.ltvTotal)[0] ?? null
    return {
      total: clientesLtv.length,
      ativos,
      ltvMedioGeral: comCompra.length > 0 ? somaLtv / comCompra.length : 0,
      ticketMedioGeral: somaCompras > 0 ? somaLtv / somaCompras : 0,
      melhorCliente,
    }
  }, [clientesLtv])

  const handleLtvSort = useCallback((field: keyof ClienteLtvStats) => {
    setLtvSortField((current) => {
      if (current === field) {
        setLtvSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return current
      }
      setLtvSortDir(field === 'nome' ? 'asc' : 'desc')
      return field
    })
  }, [])

  const clientesFiltrados = useMemo(() => {
    const term = clienteSearch.trim().toLowerCase()
    let lista = clientesLtv
    if (term) {
      lista = lista.filter(
        (c) => c.nome.toLowerCase().includes(term) || (c.telefone ?? '').toLowerCase().includes(term),
      )
    }
    if (ltvStatusFiltro !== 'todos') {
      lista = lista.filter((c) => c.status === ltvStatusFiltro)
    }
    const dir = ltvSortDir === 'asc' ? 1 : -1
    return [...lista].sort((a, b) => {
      const va = a[ltvSortField]
      const vb = b[ltvSortField]
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * dir
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return 0
    })
  }, [clientesLtv, clienteSearch, ltvStatusFiltro, ltvSortField, ltvSortDir])

  const clientesPagination = usePagination(clientesFiltrados, 10)

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
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2">
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
          {activeSection === 'geral' && (
            <ReportBlock>
              <div className="overflow-hidden rounded-xl border border-gold-100 bg-white shadow-sm">
                <div className="border-b border-gold-100 bg-cream-50/70 px-5 py-4">
                  <div className="space-y-4">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-[1px] text-gold-700">Painel principal</span>
                      <h2 className="mt-1 font-serif text-2xl text-dark-800">Visão Geral</h2>
                      <p className="text-sm text-dark-400 mt-1">Saúde financeira e operacional no período selecionado</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-gold-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[1px] text-dark-300 font-semibold">Faturamento</p>
                        <p className="mt-1 text-sm font-semibold text-dark-800">{formatMoney(saudeFinanceira.totalFaturado)}</p>
                      </div>
                      <div className="rounded-lg border border-gold-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[1px] text-dark-300 font-semibold">Resultado</p>
                        <p className={`mt-1 text-sm font-semibold ${metrics.entradas - metrics.despesas >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {formatMoney(metrics.entradas - metrics.despesas)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-gold-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[1px] text-dark-300 font-semibold">Vendas</p>
                        <p className="mt-1 text-sm font-semibold text-dark-800">{metrics.vendasQtd}</p>
                      </div>
                      <div className="rounded-lg border border-gold-100 bg-white px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[1px] text-dark-300 font-semibold">Alertas</p>
                        <p className={`mt-1 text-sm font-semibold ${estoqueAtual.alertas > 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {estoqueAtual.alertas}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-dark-700">Indicadores de saúde</h3>
                      <p className="text-xs text-dark-300 mt-0.5">Metas e sinais principais para leitura rápida da operação</p>
                    </div>
                    <span className="text-xs text-dark-300">Quanto mais próximo da meta, melhor o cenário</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className={`rounded-xl border p-4 ${saudeFinanceira.saudeMargemBruta.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Margem Bruta</p>
                          <p className="mt-3 font-display text-3xl font-bold text-dark-700">
                            {metrics.faturamento > 0 ? `${saudeFinanceira.margemBruta.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${saudeFinanceira.saudeMargemBruta.badge}`}>
                          {saudeFinanceira.saudeMargemBruta.label}
                        </span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, Math.max(0, saudeFinanceira.margemBruta))}%` }} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-xs text-dark-400">{formatMoney(metrics.lucroBruto)} de lucro bruto</p>
                        <p className="text-[11px] font-medium text-dark-400">Meta 40%</p>
                      </div>
                    </div>

                    <div className={`rounded-xl border p-4 ${saudeFinanceira.saudeMargemLiquida.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Margem Líquida</p>
                          <p className="mt-3 font-display text-3xl font-bold text-dark-700">
                            {metrics.entradas > 0 ? `${saudeFinanceira.margemLiquida.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${saudeFinanceira.saudeMargemLiquida.badge}`}>
                          {saudeFinanceira.saudeMargemLiquida.label}
                        </span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, Math.max(0, saudeFinanceira.margemLiquida))}%` }} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-xs text-dark-400">{formatMoney(metrics.entradas - metrics.despesas)} de resultado</p>
                        <p className="text-[11px] font-medium text-dark-400">Meta 20%</p>
                      </div>
                    </div>

                    <div className={`rounded-xl border p-4 ${saudeFinanceira.saudeCrediario.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Crediário em Aberto</p>
                          <p className="mt-3 font-display text-3xl font-bold text-dark-700">
                            {saudeFinanceira.totalFaturado > 0 ? `${saudeFinanceira.crediarioPct.toFixed(1)}%` : '—'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${saudeFinanceira.saudeCrediario.badge}`}>
                          {saudeFinanceira.saudeCrediario.label}
                        </span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.min(100, Math.max(0, saudeFinanceira.crediarioPct))}%` }} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-xs text-dark-400">{formatMoney(metrics.crediarioAVencer)} a receber</p>
                        <p className="text-[11px] font-medium text-dark-400">Meta 20%</p>
                      </div>
                    </div>

                    <div className={`rounded-xl border p-4 ${saudeFinanceira.saudeServicos.card}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold">Serviços Recebidos</p>
                          <p className="mt-3 font-display text-3xl font-bold text-dark-700">
                            {metrics.servicoValorTotal > 0 ? `${saudeFinanceira.servicosPct.toFixed(0)}%` : '—'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${saudeFinanceira.saudeServicos.badge}`}>
                          {saudeFinanceira.saudeServicos.label}
                        </span>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/80">
                        <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.min(100, Math.max(0, saudeFinanceira.servicosPct))}%` }} />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="text-xs text-dark-400">{formatMoney(metrics.servicoRecebido)} de {formatMoney(metrics.servicoValorTotal)}</p>
                        <p className="text-[11px] font-medium text-dark-400">Meta 80%</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader title="Resumo por Área" />
                  <div className="divide-y divide-gold-50">
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Vendas</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {metrics.vendasQtd} venda(s) · ticket médio {formatMoney(metrics.ticketMedio)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-700">{formatMoney(metrics.faturamento)}</p>
                        <p className="text-xs text-green-700 mt-0.5">lucro bruto {formatMoney(metrics.lucroBruto)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Serviços</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {metrics.servicosPagosQtd}/{metrics.servicosQtd} ordem(ns) recebida(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-700">{formatMoney(metrics.servicoRecebido)}</p>
                        <p className="text-xs text-green-700 mt-0.5">lucro {formatMoney(metrics.servicoLucro)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Crediário</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {metrics.crediarioParcelas} contrato(s) no período
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-dark-700">{formatMoney(metrics.crediarioRecebido)}</p>
                        <p className="text-xs text-dark-400 mt-0.5">{formatMoney(metrics.crediarioAVencer)} a receber</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Caixa</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {formatMoney(metrics.entradas)} entradas · {formatMoney(metrics.despesas)} saídas
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${metrics.entradas - metrics.despesas >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {formatMoney(metrics.entradas - metrics.despesas)}
                        </p>
                        <p className="text-xs text-dark-400 mt-0.5">resultado</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Estoque</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {estoqueAtual.unidades} un · {estoqueAtual.alertas} alerta(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${estoqueAtual.alertas > 0 ? 'text-red-600' : 'text-green-700'}`}>
                          {estoqueAtual.alertas > 0 ? `${estoqueAtual.alertas} em alerta` : 'Normalizado'}
                        </p>
                        <p className="text-xs text-dark-400 mt-0.5">{estoqueAtual.produtosCriticos} produto(s)</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-semibold text-dark-700">Contas a Pagar</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {contasMetrics.qtdVencidas > 0
                            ? `${contasMetrics.qtdVencidas} vencida(s)`
                            : `${contasMetrics.pendentes.length} pendente(s)`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${contasMetrics.qtdVencidas > 0 ? 'text-red-600' : 'text-dark-700'}`}>
                          {formatMoney(contasMetrics.totalPendente)}
                        </p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {contasMetrics.qtdVencidas > 0
                            ? `${formatMoney(contasMetrics.valorVencido)} vencido`
                            : 'Em dia'}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Comparativo de Resultados" />
                  <BarCompareReport
                    data={[
                      { name: 'Faturamento', value: saudeFinanceira.totalFaturado },
                      { name: 'Custo', value: saudeFinanceira.totalFaturado - metrics.lucroBruto - metrics.servicoLucro },
                      { name: 'Lucro Bruto', value: metrics.lucroBruto + metrics.servicoLucro },
                      { name: 'Despesas', value: metrics.despesas },
                      { name: 'Resultado', value: metrics.entradas - metrics.despesas },
                    ]}
                  />
                </Card>
              </div>
            </ReportBlock>
          )}

          {activeSection === 'vendas' && (
            <ReportBlock>
              <SectionTitle title="Vendas" subtitle="Recebimentos de vendas fora do crediario; parcelas ficam na aba Crediario" />

              {/* Sub-navegação Normal / Livre */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {(['todas', 'normal', 'livre'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setVendasSubTab(tab)}
                      className={[
                        'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400/50',
                        vendasSubTab === tab
                          ? 'border-gold-500 bg-gold-500 text-dark-800 shadow-sm'
                          : 'border-gold-100 bg-white text-dark-500 hover:bg-cream-50 hover:border-gold-200',
                      ].join(' ')}
                    >
                      {tab === 'todas' ? 'Todas' : tab === 'normal' ? 'Venda Normal' : 'Venda Livre'}
                    </button>
                  ))}
                </div>
                {vendasSubTab === 'livre' && (
                  <label className="flex cursor-pointer select-none items-center gap-2">
                    <input
                      type="checkbox"
                      checked={combinarTipos}
                      onChange={(e) => setCombinarTipos(e.target.checked)}
                      className="h-4 w-4 rounded border-gold-300 accent-gold-600"
                    />
                    <span className="text-sm text-dark-600">Incluir venda normal no faturamento</span>
                  </label>
                )}
              </div>

              {/* Métricas — Todas */}
              {vendasSubTab === 'todas' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Vendas Recebidas" value={formatMoney(metrics.faturamento)} changeType="up" accent />
                  <MetricCard label="Lucro Bruto" value={formatMoney(metrics.lucroBruto)} changeType={metrics.lucroBruto >= 0 ? 'up' : 'down'} />
                  <MetricCard label="Ticket Medio" value={metrics.vendasQtd > 0 ? formatMoney(metrics.ticketMedio) : '-'} changeType="neutral" />
                  <MetricCard label="Vendas" value={String(metrics.vendasQtd)} changeType="neutral" />
                </div>
              )}

              {/* Métricas — Venda Normal */}
              {vendasSubTab === 'normal' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <MetricCard label="Faturamento Normal" value={formatMoney(vendasPorTipo.faturamentoNormal)} changeType="up" accent />
                  <MetricCard label="Lucro Bruto" value={formatMoney(vendasPorTipo.lucroNormal)} changeType={vendasPorTipo.lucroNormal >= 0 ? 'up' : 'down'} />
                  <MetricCard label="Ticket Medio" value={vendasPorTipo.qtdNormal > 0 ? formatMoney(vendasPorTipo.tickMedioNormal) : '-'} changeType="neutral" />
                  <MetricCard label="Quantidade" value={String(vendasPorTipo.qtdNormal)} changeType="neutral" />
                </div>
              )}

              {/* Métricas — Venda Livre */}
              {vendasSubTab === 'livre' && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                      label={combinarTipos ? 'Faturamento Total' : 'Faturamento Livre'}
                      value={formatMoney(combinarTipos
                        ? vendasPorTipo.faturamentoLivre + vendasPorTipo.faturamentoNormal
                        : vendasPorTipo.faturamentoLivre)}
                      changeType="up"
                      accent
                    />
                    <MetricCard label="À Vista (Livre)" value={formatMoney(vendasPorTipo.livreAVistaValor)} change={`${vendasPorTipo.livreAVistaQtd} venda(s)`} changeType="up" />
                    <MetricCard label="Crediário (Livre)" value={formatMoney(vendasPorTipo.livreCrediariadoValor)} change={`${vendasPorTipo.livreCrediariadasQtd} venda(s)`} changeType="neutral" />
                    <MetricCard label="Qtd Vendas Livres" value={String(vendasPorTipo.qtdLivre)} changeType="neutral" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader title="Vendas Livre por Descrição" />
                      {Object.keys(vendasPorTipo.livreByDescricao).length === 0 ? (
                        <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas livres no período" />
                      ) : (
                        <ProductSalesReport
                          data={Object.entries(vendasPorTipo.livreByDescricao)
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)}
                        />
                      )}
                    </Card>
                    <Card>
                      <CardHeader title="Crediário vs À Vista (Livre)" />
                      <BarCompareReport
                        data={[
                          { name: 'À Vista', value: vendasPorTipo.livreAVistaValor },
                          { name: 'Crediário', value: vendasPorTipo.livreCrediariadoValor },
                        ]}
                      />
                    </Card>
                  </div>
                </>
              )}

              {/* Gráficos de produto e resultado — Todas e Normal */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader
                    title="Ranking de Vendedores"
                    subtitle={`${vendasEquipe.quantidade} venda(s) no filtro`}
                    actions={
                      <SearchableSelect
                        value={vendedorFiltro === 'todos' ? null : vendedorFiltro}
                        displayValue={vendedorRankingSelecionado}
                        onChange={(id) => {
                          setVendedorFiltro(id ?? 'todos')
                          return true
                        }}
                        onSearch={searchVendedoresRanking}
                        placeholder="Buscar vendedor..."
                        className="w-56"
                      />
                    }
                  />
                  {vendasEquipe.ranking.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas no periodo" />
                  ) : (
                    <div className="space-y-3">
                      {vendasEquipe.ranking.map((vendedor, index) => {
                        const pct = vendasEquipe.total > 0 ? (vendedor.total / vendasEquipe.total) * 100 : 0
                        return (
                          <div key={vendedor.id} className="rounded-lg border border-gold-100 bg-cream-50/40 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-dark-700 truncate">
                                  #{index + 1} {vendedor.nome}
                                </p>
                                <p className="text-xs text-dark-400 mt-0.5">
                                  {vendedor.quantidade} venda(s) - ticket medio {formatMoney(vendedor.ticketMedio)}
                                </p>
                              </div>
                              <p className="text-sm font-semibold text-dark-800">{formatMoney(vendedor.total)}</p>
                            </div>
                            <div className="mt-2 h-2 rounded-full bg-gold-100 overflow-hidden">
                              <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>

                <Card>
                  <CardHeader title="Formas de Pagamento" subtitle="Valor vendido por forma" />
                  {vendasEquipe.formasPagamento.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem pagamentos no periodo" />
                  ) : (
                    <div className="space-y-3">
                      {vendasEquipe.formasPagamento.map((forma) => (
                        <div key={forma.forma}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <div>
                              <p className="font-semibold text-dark-700">{forma.label}</p>
                              <p className="text-xs text-dark-400">{forma.quantidade} venda(s) - {forma.pct.toFixed(1)}%</p>
                            </div>
                            <p className="font-semibold text-dark-800">{formatMoney(forma.total)}</p>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-gold-100 overflow-hidden">
                            <div className="h-full rounded-full bg-gold-500" style={{ width: `${Math.min(100, forma.pct)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {vendasSubTab !== 'livre' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader title="Vendas por Produto" />
                    {charts.vendasProduto.length === 0 ? (
                      <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas no periodo" />
                    ) : (
                      <ProductSalesReport data={charts.vendasProduto} />
                    )}
                  </Card>
                  <Card>
                    <CardHeader title="Comparativo de Resultado" />
                    <BarCompareReport
                      data={vendasSubTab === 'normal'
                        ? [
                            { name: 'Faturamento', value: vendasPorTipo.faturamentoNormal },
                            { name: 'Lucro bruto', value: vendasPorTipo.lucroNormal },
                            { name: 'Lucro liquido', value: vendasPorTipo.lucroNormal - metrics.despesas },
                          ]
                        : [
                            { name: 'Faturamento', value: metrics.faturamento },
                            { name: 'Lucro bruto', value: metrics.lucroBruto },
                            { name: 'Lucro liquido', value: metrics.lucroLiquido },
                          ]}
                    />
                  </Card>
                </div>
              )}

              {/* Vendas por Tipo — Normal vs Livre lado a lado */}
              {vendasPorTipo.tipoSerie.length > 0 && (
                <Card>
                  <CardHeader
                    title={
                      vendasSubTab === 'normal' ? 'Vendas por Período — Venda Normal'
                      : vendasSubTab === 'livre' ? 'Vendas por Período — Venda Livre'
                      : 'Vendas por Tipo — Normal vs Livre'
                    }
                  />
                  <VendasTipoChart data={vendasPorTipo.tipoSerie} mode={vendasSubTab} />
                </Card>
              )}
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
              <SectionTitle title="Crediario" subtitle="Entradas e pagamentos recebidos; saldo devedor dos crediarios abertos no periodo" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Recebido" value={formatMoney(metrics.crediarioRecebido)} changeType="up" />
                <MetricCard label="A Receber" value={formatMoney(metrics.crediarioAVencer)} changeType="neutral" />
                <MetricCard label="Crediarios no Periodo" value={String(metrics.crediarioParcelas)} changeType="neutral" />
                <MetricCard label="Saldo Projetado" value={formatMoney(metrics.crediarioAVencer)} changeType={metrics.crediarioAVencer > 0 ? 'down' : 'neutral'} />
              </div>
            </ReportBlock>
          )}

          {activeSection === 'leads' && (
            <ReportBlock>
              <SectionTitle title="Análise de Leads" subtitle="Origem dos clientes registrada em vendas e serviços do período" />

              {analiseLeads.total === 0 ? (
                <Card>
                  <EmptyState
                    imageSrc="/images/Analytics-rafiki.svg"
                    title="Sem dados de origem no período"
                  />
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard label="Total com origem" value={String(analiseLeads.total)} changeType="up" accent />
                    <MetricCard label="Canais distintos" value={String(analiseLeads.allOrigens.length)} changeType="neutral" />
                    <MetricCard label="Principal canal" value={analiseLeads.ranking[0]?.nome ?? '—'} changeType="neutral" />
                    <MetricCard
                      label="Sem origem"
                      value={String(analiseLeads.semOrigem)}
                      changeType={analiseLeads.semOrigem > 0 ? 'down' : 'neutral'}
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader title="Distribuição por Canal" />
                      <LeadsDonutReport data={analiseLeads.pieData} />
                    </Card>
                    <Card>
                      <CardHeader title="Ranking de Canais" />
                      <div className="space-y-3 pt-2">
                        {analiseLeads.ranking.map((item, i) => (
                          <div key={item.nome} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="w-5 flex-shrink-0 text-[11px] font-bold text-dark-300">#{i + 1}</span>
                                <span
                                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                                />
                                <span className="truncate text-sm font-medium text-dark-700">{item.nome}</span>
                              </div>
                              <div className="flex flex-shrink-0 items-baseline gap-3">
                                <span className="text-xs text-dark-400">{formatMoney(item.valor)}</span>
                                <span className="text-sm font-semibold text-dark-700">
                                  {item.count} lead{item.count !== 1 ? 's' : ''}
                                </span>
                                <span className="w-9 text-right text-[11px] text-dark-300">
                                  {item.pct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.max(3, item.pct)}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>

                  {analiseLeads.timeline.length > 1 && (
                    <Card>
                      <CardHeader title="Evolução das Origens no Período" />
                      <LeadsTimeline data={analiseLeads.timeline} origens={analiseLeads.allOrigens} />
                    </Card>
                  )}
                </>
              )}
            </ReportBlock>
          )}

          {activeSection === 'contas' && (
            <ReportBlock>
              <SectionTitle title="Contas a Pagar" subtitle="Visão consolidada das contas fixas e variáveis cadastradas" />

              {/* Métricas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard label="Total Pendente" value={formatMoney(contasMetrics.totalPendente)} changeType="neutral" />
                <MetricCard
                  label="Vencidas"
                  value={formatMoney(contasMetrics.valorVencido)}
                  changeType={contasMetrics.qtdVencidas > 0 ? 'down' : 'neutral'}
                  change={contasMetrics.qtdVencidas > 0 ? `${contasMetrics.qtdVencidas} conta(s)` : 'Nenhuma vencida'}
                />
                <MetricCard
                  label="Pagas no Período"
                  value={formatMoney(contasMetrics.totalPagasNoPeriodo)}
                  changeType="up"
                  change={`${contasMetrics.qtdPagasNoPeriodo} conta(s) quitada(s)`}
                />
                <MetricCard label="Fixas / Variáveis" value={`${contasMetrics.qtdFixas} / ${contasMetrics.qtdVariaveis}`} changeType="neutral" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Fixas vs Variáveis */}
                <Card>
                  <CardHeader title="Fixas vs Variáveis" />
                  {contasMetrics.qtdFixas + contasMetrics.qtdVariaveis === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem contas cadastradas" />
                  ) : (
                    <BarCompareReport
                      data={[
                        { name: 'Fixas', value: contasMetrics.totalFixas },
                        { name: 'Variáveis', value: contasMetrics.totalVariaveis },
                      ]}
                    />
                  )}
                </Card>

                {/* Evolução mensal */}
                <Card>
                  <CardHeader title="Evolução Mensal" />
                  {contasMetrics.evolucao.length === 0 ? (
                    <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem dados no período" />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={contasMetrics.evolucao} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
                        <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} tickFormatter={numberFormat} />
                        <Tooltip
                          formatter={(value, name) => [formatMoney(Number(value)), name === 'pago' ? 'Pago' : 'Pendente']}
                          contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }}
                        />
                        <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#6B5B45' }}>{value === 'pago' ? 'Pago' : 'Pendente'}</span>} />
                        <Bar dataKey="pago" name="pago" fill="#5B8C5B" radius={[3, 3, 0, 0]} stackId="a" />
                        <Bar dataKey="pendente" name="pendente" fill="#EBD9A4" radius={[3, 3, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Card>
              </div>

              {/* Lista de vencidas */}
              {contasMetrics.vencidas.length > 0 && (
                <Card>
                  <CardHeader title="Contas Vencidas" subtitle="Requerem atenção imediata" />
                  <div className="divide-y divide-gold-50">
                    {contasMetrics.vencidas.map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-dark-800 truncate">{conta.nome}</p>
                            {conta.fixa && (
                              <span className="flex-shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-700">Fixa</span>
                            )}
                          </div>
                          {conta.descricao && <p className="text-xs text-dark-400 mt-0.5 truncate">{conta.descricao}</p>}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <p className="text-sm font-bold text-red-600">{formatMoney(conta.valor)}</p>
                          <p className="text-xs text-red-500 mt-0.5">
                            Venceu {conta.data_vencimento.split('-').reverse().join('/')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Lista de pagas no período */}
              {contasMetrics.pagasNoPeriodo.length > 0 && (
                <Card>
                  <CardHeader title="Pagas no Período" />
                  <div className="divide-y divide-gold-50">
                    {contasMetrics.pagasNoPeriodo.map((conta) => (
                      <div key={conta.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-dark-800 truncate">{conta.nome}</p>
                            {conta.fixa && (
                              <span className="flex-shrink-0 rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-700">Fixa</span>
                            )}
                          </div>
                          <p className="text-xs text-dark-400 mt-0.5">
                            Paga em {conta.data_pagamento?.split('-').reverse().join('/')} · {conta.forma_pagamento}
                          </p>
                        </div>
                        <p className="flex-shrink-0 text-sm font-bold text-green-700">{formatMoney(conta.valor)}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {contasMetrics.vencidas.length === 0 && contasMetrics.pagasNoPeriodo.length === 0 && contasMetrics.pendentes.length === 0 && (
                <Card>
                  <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Nenhuma conta cadastrada" description="Acesse Contas a Pagar para registrar contas fixas e variáveis." />
                </Card>
              )}
            </ReportBlock>
          )}

          {activeSection === 'clientes' && (
            <ReportBlock>
              <SectionTitle title="Clientes" subtitle="LTV histórico de cada cliente cadastrado, calculado a partir de todo o histórico de vendas" />

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Clientes cadastrados"
                  value={String(clientesLtvResumo.total)}
                  changeType="neutral"
                />
                <MetricCard
                  label="Clientes ativos"
                  value={String(clientesLtvResumo.ativos)}
                  change={clientesLtvResumo.total > 0
                    ? `${((clientesLtvResumo.ativos / clientesLtvResumo.total) * 100).toFixed(0)}% do total · inativo após ${ltvInatividadeDias}d`
                    : undefined}
                  changeType="neutral"
                />
                <MetricCard
                  label="LTV médio"
                  value={formatMoney(clientesLtvResumo.ltvMedioGeral)}
                  changeType="neutral"
                />
                <MetricCard
                  label="Ticket médio geral"
                  value={formatMoney(clientesLtvResumo.ticketMedioGeral)}
                  changeType="neutral"
                />
              </div>

              {clientesLtv.length === 0 ? (
                <Card>
                  <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Nenhum cliente cadastrado" description="Cadastre clientes para acompanhar o LTV histórico." />
                </Card>
              ) : (
                <Card>
                  {/* Cabeçalho */}
                  <div className="border-b border-gold-100 bg-cream-50/60 px-5 py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <div className="lg:flex-shrink-0">
                        <span className="text-[11px] font-bold uppercase tracking-[1px] text-gold-700">LTV por cliente</span>
                        <h2 className="mt-1 font-serif text-xl text-dark-800">Valor histórico de cada cliente</h2>
                        <p className="mt-0.5 text-xs text-dark-400">
                          {clientesFiltrados.length} de {clientesLtv.length} cliente{clientesLtv.length !== 1 ? 's' : ''} cadastrado{clientesLtv.length !== 1 ? 's' : ''}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-3 lg:flex-1 lg:min-w-0">
                        <Select
                          value={ltvStatusFiltro}
                          onChange={(e) => setLtvStatusFiltro(e.target.value as 'todos' | ClienteLtvStatus)}
                          wrapperClassName="w-full sm:w-40"
                        >
                          <option value="todos">Todos status</option>
                          <option value="ativo">Ativos</option>
                          <option value="inativo">Inativos</option>
                        </Select>
                        <Select
                          value={String(ltvInatividadeDias)}
                          onChange={(e) => setLtvInatividadeDias(Number(e.target.value))}
                          wrapperClassName="w-full sm:w-52"
                        >
                          <option value="30">Inativo após 30 dias</option>
                          <option value="60">Inativo após 60 dias</option>
                          <option value="90">Inativo após 90 dias</option>
                          <option value="120">Inativo após 120 dias</option>
                          <option value="180">Inativo após 180 dias</option>
                        </Select>
                        <SearchInput
                          value={clienteSearch}
                          onChange={setClienteSearch}
                          placeholder="Buscar por nome ou telefone..."
                          className="w-full min-w-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tabela */}
                  {clientesFiltrados.length === 0 ? (
                    <div className="flex flex-col items-center gap-1 px-5 py-10 text-center">
                      <Search size={22} className="text-dark-200 mb-1" />
                      <p className="text-sm font-medium text-dark-600">Nenhum resultado</p>
                      <p className="text-xs text-dark-400">
                        {clienteSearch ? <>Nenhum cliente encontrado para &ldquo;{clienteSearch}&rdquo;</> : 'Nenhum cliente corresponde ao filtro selecionado'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gold-100 bg-cream-50/50">
                            <LtvSortHeader label="Cliente" field="nome" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} />
                            <LtvSortHeader label="Compras" field="compras" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden md:table-cell" />
                            <LtvSortHeader label="LTV histórico" field="ltvTotal" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} />
                            <LtvSortHeader label="Ticket médio" field="ticketMedio" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden md:table-cell" />
                            <LtvSortHeader label="1ª compra" field="primeiraCompra" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden lg:table-cell" />
                            <LtvSortHeader label="Última compra" field="ultimaCompra" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden lg:table-cell" />
                            <LtvSortHeader label="Tempo de vida" field="tempoVidaDias" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden xl:table-cell" />
                            <LtvSortHeader label="Recência" field="recenciaDias" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} />
                            <LtvSortHeader label="Frequência" field="frequenciaMensal" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} className="hidden lg:table-cell" />
                            <LtvSortHeader label="Status" field="status" sortField={ltvSortField} sortDir={ltvSortDir} onSort={handleLtvSort} />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gold-50">
                          {clientesPagination.paginated.map((cliente) => (
                            <tr
                              key={cliente.id}
                              className="hover:bg-[#FAF7F0] transition-colors cursor-pointer"
                              onClick={() => setClienteLtvDetalhe(cliente)}
                            >
                              <td className="px-4 py-3 max-w-[200px]">
                                <p className="font-medium text-dark-700 truncate">{cliente.nome}</p>
                                {cliente.telefone && <p className="text-xs text-dark-400 truncate">{cliente.telefone}</p>}
                              </td>
                              <td className="hidden md:table-cell px-4 py-3 text-dark-600">{cliente.compras}</td>
                              <td className="px-4 py-3 font-semibold text-gold-700 whitespace-nowrap">{formatMoney(cliente.ltvTotal)}</td>
                              <td className="hidden md:table-cell px-4 py-3 text-dark-600 whitespace-nowrap">
                                {cliente.ticketMedio !== null ? formatMoney(cliente.ticketMedio) : '—'}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-dark-400 whitespace-nowrap">{formatDate(cliente.primeiraCompra)}</td>
                              <td className="hidden lg:table-cell px-4 py-3 text-dark-400 whitespace-nowrap">{formatDate(cliente.ultimaCompra)}</td>
                              <td className="hidden xl:table-cell px-4 py-3 text-dark-600 whitespace-nowrap">
                                {cliente.tempoVidaDias !== null ? `${cliente.tempoVidaDias} dia${cliente.tempoVidaDias !== 1 ? 's' : ''}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-dark-600 whitespace-nowrap">
                                {cliente.recenciaDias !== null ? `${cliente.recenciaDias} dia${cliente.recenciaDias !== 1 ? 's' : ''}` : '—'}
                              </td>
                              <td className="hidden lg:table-cell px-4 py-3 text-dark-600 whitespace-nowrap">
                                {formatFrequenciaCompra(cliente.frequenciaMensal)}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={cliente.status === 'ativo' ? 'success' : 'gray'}>
                                  {cliente.status === 'ativo' ? 'Ativo' : 'Inativo'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <Pagination
                    page={clientesPagination.page}
                    totalPages={clientesPagination.totalPages}
                    onPageChange={clientesPagination.setPage}
                    from={clientesPagination.from}
                    to={clientesPagination.to}
                    total={clientesPagination.total}
                  />
                </Card>
              )}

              {analiseClientes.rankingVendedores.length > 0 && (
                <Card>
                  <CardHeader
                    title="Ranking de Vendedores por LTV"
                    subtitle="LTV acumulado dos clientes atendidos por cada vendedor no período"
                  />
                  <div className="divide-y divide-gold-50">
                    {analiseClientes.rankingVendedores.map((v, idx) => {
                      const maxLtv = analiseClientes.rankingVendedores[0]?.ltvTotal ?? 1
                      const pct = maxLtv > 0 ? (v.ltvTotal / maxLtv) * 100 : 0
                      return (
                        <div key={v.nome} className="flex items-center gap-4 py-3">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-100 flex items-center justify-center text-[11px] font-bold text-gold-700">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-dark-800 truncate">{v.nome}</p>
                              <div className="flex-shrink-0 text-right">
                                <p className="text-sm font-bold text-dark-800">{formatMoney(v.ltvTotal)}</p>
                                <p className="text-xs text-dark-400">{v.qtdClientes} cliente{v.qtdClientes !== 1 ? 's' : ''}</p>
                              </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-gold-100">
                              <div
                                className="h-full rounded-full bg-gold-500 transition-all"
                                style={{ width: `${Math.max(3, pct)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>
              )}

              <Modal
                open={!!clienteLtvDetalhe}
                onClose={() => setClienteLtvDetalhe(null)}
                title={clienteLtvDetalhe?.nome ?? 'Cliente'}
                size="md"
              >
                {clienteLtvDetalhe && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-dark-400">{clienteLtvDetalhe.telefone ?? 'Sem telefone cadastrado'}</p>
                      <Badge variant={clienteLtvDetalhe.status === 'ativo' ? 'success' : 'gray'}>
                        {clienteLtvDetalhe.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <LtvDetailItem label="Número de compras" value={String(clienteLtvDetalhe.compras)} />
                      <LtvDetailItem label="LTV histórico" value={formatMoney(clienteLtvDetalhe.ltvTotal)} highlight />
                      <LtvDetailItem
                        label="Ticket médio"
                        value={clienteLtvDetalhe.ticketMedio !== null ? formatMoney(clienteLtvDetalhe.ticketMedio) : '—'}
                      />
                      <LtvDetailItem label="1ª compra" value={formatDate(clienteLtvDetalhe.primeiraCompra)} />
                      <LtvDetailItem label="Última compra" value={formatDate(clienteLtvDetalhe.ultimaCompra)} />
                      <LtvDetailItem
                        label="Tempo de vida"
                        value={clienteLtvDetalhe.tempoVidaDias !== null
                          ? `${clienteLtvDetalhe.tempoVidaDias} dia${clienteLtvDetalhe.tempoVidaDias !== 1 ? 's' : ''}`
                          : '—'}
                      />
                      <LtvDetailItem
                        label="Recência"
                        value={clienteLtvDetalhe.recenciaDias !== null
                          ? `${clienteLtvDetalhe.recenciaDias} dia${clienteLtvDetalhe.recenciaDias !== 1 ? 's' : ''} sem comprar`
                          : '—'}
                      />
                      <LtvDetailItem
                        label="Frequência de compra"
                        value={formatFrequenciaCompra(clienteLtvDetalhe.frequenciaMensal)}
                      />
                    </div>
                  </div>
                )}
              </Modal>
            </ReportBlock>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function LtvSortHeader({ label, field, sortField, sortDir, onSort, className }: {
  label: string
  field: keyof ClienteLtvStats
  sortField: keyof ClienteLtvStats
  sortDir: 'asc' | 'desc'
  onSort: (field: keyof ClienteLtvStats) => void
  className?: string
}) {
  const active = field === sortField
  return (
    <th className={`px-4 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wide ${className ?? ''}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 hover:text-gold-700 transition-colors whitespace-nowrap"
      >
        {label}
        {active && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </button>
    </th>
  )
}

function LtvDetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${highlight ? 'border-gold-200 bg-gold-50/60' : 'border-gold-100 bg-cream-50'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[1px] text-dark-300">{label}</p>
      <p className={`mt-1 text-sm font-semibold ${highlight ? 'text-gold-700' : 'text-dark-700'}`}>{value}</p>
    </div>
  )
}

function ProductSalesReport({ data }: { data: CategoriaData[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)
  const topProducts = data.slice(0, 7)
  const visibleTotal = topProducts.reduce((sum, item) => sum + item.value, 0)
  const chartData = visibleTotal < total
    ? [...topProducts.slice(0, 5), { name: 'Outros', value: total - topProducts.slice(0, 5).reduce((sum, item) => sum + item.value, 0) }]
    : topProducts.slice(0, 5)
  const leadingProduct = topProducts[0]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-gold-100 bg-cream-50 px-4 py-3">
          <p className="text-[11px] font-medium uppercase text-dark-300">Total vendido</p>
          <p className="mt-1 text-lg font-bold text-dark-700">{formatMoney(total)}</p>
        </div>
        <div className="rounded-lg border border-gold-100 bg-white px-4 py-3">
          <p className="text-[11px] font-medium uppercase text-dark-300">Produtos</p>
          <p className="mt-1 text-lg font-bold text-dark-700">{data.length}</p>
        </div>
        <div className="rounded-lg border border-gold-100 bg-white px-4 py-3">
          <p className="text-[11px] font-medium uppercase text-dark-300">Maior venda</p>
          <p className="mt-1 truncate text-sm font-semibold text-dark-700" title={leadingProduct.name}>
            {leadingProduct.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[160px_1fr] gap-5 items-center">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={46}
                outerRadius={70}
                paddingAngle={2}
                stroke="#FFFFFF"
                strokeWidth={2}
              >
                {chartData.map((_, index) => (
                  <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {topProducts.map((item, index) => {
            const percentage = total > 0 ? (item.value / total) * 100 : 0

            return (
              <div key={item.name} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate text-xs font-medium text-dark-600" title={item.name}>{item.name}</span>
                  </div>
                  <div className="flex flex-shrink-0 items-baseline gap-2">
                    <span className="text-xs font-semibold text-dark-700">{formatMoney(item.value)}</span>
                    <span className="w-10 text-right text-[11px] text-dark-300">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-cream-200">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(3, percentage)}%`,
                      backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            )
          })}

          {data.length > topProducts.length && (
            <div className="rounded-lg bg-cream-50 px-3 py-2 text-xs text-dark-400">
              +{data.length - topProducts.length} produto(s) no restante das vendas
            </div>
          )}
        </div>
      </div>
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

function VendasTipoChart({ data, mode }: {
  data: { periodo: string; normal: number; livre: number }[]
  mode: VendasSubTab
}) {
  const hasData = mode === 'normal'
    ? data.some((d) => d.normal > 0)
    : mode === 'livre'
      ? data.some((d) => d.livre > 0)
      : data.some((d) => d.normal > 0 || d.livre > 0)

  if (!hasData) return <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem dados no período" />

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
        <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} tickFormatter={numberFormat} />
        <Tooltip
          formatter={(value, name) => [formatMoney(Number(value)), name === 'normal' ? 'Venda Normal' : 'Venda Livre']}
          contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }}
        />
        {mode === 'todas' && (
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11, color: '#6B5B45' }}>
                {value === 'normal' ? 'Venda Normal' : 'Venda Livre'}
              </span>
            )}
          />
        )}
        {(mode === 'todas' || mode === 'normal') && (
          <Bar dataKey="normal" name="normal" fill="#B8962E" radius={[3, 3, 0, 0]} />
        )}
        {(mode === 'todas' || mode === 'livre') && (
          <Bar dataKey="livre" name="livre" fill="#EBD9A4" radius={[3, 3, 0, 0]} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

function LeadsDonutReport({ data }: { data: CategoriaData[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={58}
          outerRadius={88}
          paddingAngle={2}
          stroke="#FFFFFF"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [
            `${value} lead${Number(value) !== 1 ? 's' : ''} (${total > 0 ? ((Number(value) / total) * 100).toFixed(0) : 0}%)`,
            'Leads',
          ]}
          contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }}
        />
        <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#6B5B45' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

function LeadsTimeline({ data, origens }: { data: Record<string, number | string>[]; origens: string[] }) {
  const topOrigens = origens.slice(0, 5)

  if (topOrigens.length === 0 || data.length === 0) {
    return <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem dados de evolução" />
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
        <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip
          formatter={(value, name) => [`${value} lead${Number(value) !== 1 ? 's' : ''}`, String(name)]}
          contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }}
        />
        <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#6B5B45' }}>{value}</span>} />
        {topOrigens.map((origem, i) => (
          <Line
            key={origem}
            type="monotone"
            dataKey={origem}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3, fill: CHART_COLORS[i % CHART_COLORS.length] }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
