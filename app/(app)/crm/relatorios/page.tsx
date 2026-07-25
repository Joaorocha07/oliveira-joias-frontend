'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, differenceInDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Download } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, CardHeader, MetricCard, Spinner, EmptyState, Button,
  PeriodFilter, getPeriodRange, type PeriodPreset,
} from '@/components/ui'
import {
  formatMoney, PRODUTO_INTERESSE_LABEL, PRODUTO_CATEGORIA_LABEL,
} from '@/utils'
import type { ProdutoInteresse, ProdutoCategoria } from '@/types'

interface LeadRow {
  id: string
  origem_id: string | null
  origem_outro: string | null
  produto_interesse: ProdutoInteresse | null
  vendedor_id: string | null
  status_funil: string
  motivo_perda: string | null
  created_at: string
  origem?: { nome: string } | null
}

interface VendaRow {
  id: string
  total: number
  data_venda: string
  vendedor_id: string | null
  cliente_id: string | null
  origem_id: string | null
  origem_outro: string | null
  itens?: { subtotal: number; produto?: { categoria: ProdutoCategoria } | { categoria: ProdutoCategoria }[] | null }[]
}

function buildSeries(datas: string[], dataInicio: string, dataFim: string) {
  const useDay = differenceInCalendarDays(parseISO(dataFim), parseISO(dataInicio)) <= 60
  const totals = new Map<string, number>()
  datas.forEach((d) => {
    const date = parseISO(d)
    const key = useDay ? format(date, 'dd/MM') : format(date, 'MMM/yy', { locale: ptBR })
    totals.set(key, (totals.get(key) ?? 0) + 1)
  })
  return Array.from(totals.entries()).map(([periodo, total]) => ({ periodo, total }))
}

export default function CrmRelatoriosPage() {
  const { profile } = useAuth()
  const alert = useAlert()
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [vendedores, setVendedores] = useState<{ id: string; nome: string; comissao_percentual: number }[]>([])
  const [exportando, setExportando] = useState(false)

  const escopoVendedor = profile?.role === 'vendedor' ? profile.id : undefined

  async function handleExportarPdf() {
    const element = document.getElementById('crm-relatorios-print-area')
    if (!element) return
    setExportando(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const imgData = canvas.toDataURL('image/png')

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`relatorio-crm-${dataInicio}-a-${dataFim}.pdf`)
    } finally {
      setExportando(false)
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)

    let leadsQuery = supabase
      .from('clientes')
      .select('id, origem_id, origem_outro, produto_interesse, vendedor_id, status_funil, motivo_perda, created_at, origem:origens_cliente(nome)')
      .eq('ativo', true)
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
    if (escopoVendedor) leadsQuery = leadsQuery.or(`vendedor_id.eq.${escopoVendedor},vendedor_id.is.null`)

    let vendasQuery = supabase
      .from('vendas')
      .select('id, total, data_venda, vendedor_id, cliente_id, origem_id, origem_outro, itens:venda_itens(subtotal, produto:produtos(categoria))')
      .neq('status', 'cancelado')
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim)
    if (escopoVendedor) vendasQuery = vendasQuery.eq('vendedor_id', escopoVendedor)

    const [leadsRes, vendasRes, vendedoresRes] = await Promise.all([
      leadsQuery,
      vendasQuery,
      supabase.from('profiles').select('id, nome, comissao_percentual').eq('ativo', true).in('role', ['vendedor', 'admin']),
    ])

    if (leadsRes.error || vendasRes.error) alert.error('Erro', 'Erro ao carregar relatórios do CRM.')
    setLeads((leadsRes.data ?? []) as unknown as LeadRow[])
    setVendas((vendasRes.data ?? []) as unknown as VendaRow[])
    setVendedores((vendedoresRes.data ?? []) as { id: string; nome: string; comissao_percentual: number }[])
    setLoading(false)
  }, [dataInicio, dataFim, escopoVendedor])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [carregar])

  const leadsSeries = useMemo(() => buildSeries(leads.map((l) => l.created_at), dataInicio, dataFim), [leads, dataInicio, dataFim])

  // Conversão: quantos leads do período já viraram venda (mesmo cliente_id em vendas)
  const clienteIdsComVenda = useMemo(() => new Set(vendas.map((v) => v.cliente_id).filter(Boolean)), [vendas])
  const leadsConvertidos = useMemo(() => leads.filter((l) => clienteIdsComVenda.has(l.id)), [leads, clienteIdsComVenda])
  const taxaConversaoLeadVenda = leads.length > 0 ? (leadsConvertidos.length / leads.length) * 100 : 0
  const valorMedioPedido = vendas.length > 0 ? vendas.reduce((s, v) => s + v.total, 0) / vendas.length : 0

  const tempoMedioFechamento = useMemo(() => {
    const leadsPorId = new Map(leads.map((l) => [l.id, l]))
    const dias: number[] = []
    vendas.forEach((v) => {
      if (!v.cliente_id) return
      const lead = leadsPorId.get(v.cliente_id)
      if (!lead) return
      dias.push(Math.max(0, differenceInDays(parseISO(v.data_venda), parseISO(lead.created_at))))
    })
    return dias.length > 0 ? dias.reduce((s, d) => s + d, 0) / dias.length : 0
  }, [leads, vendas])

  // Comparativo por origem
  const origemComparativo = useMemo(() => {
    const map = new Map<string, { leads: number; vendas: number; faturamento: number }>()
    const nomeOrigem = (origemId: string | null, origemOutro: string | null, origemNome?: string | null) =>
      origemNome || origemOutro || 'Não informado'

    leads.forEach((l) => {
      const nome = nomeOrigem(l.origem_id, l.origem_outro, l.origem?.nome)
      if (!map.has(nome)) map.set(nome, { leads: 0, vendas: 0, faturamento: 0 })
      map.get(nome)!.leads++
    })
    vendas.forEach((v) => {
      const nome = nomeOrigem(v.origem_id, v.origem_outro)
      if (!map.has(nome)) map.set(nome, { leads: 0, vendas: 0, faturamento: 0 })
      const row = map.get(nome)!
      row.vendas++
      row.faturamento += v.total
    })
    return Array.from(map.entries())
      .map(([nome, dados]) => ({
        nome, ...dados,
        conversao: dados.leads > 0 ? (dados.vendas / dados.leads) * 100 : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)
  }, [leads, vendas])

  const produtoMaisProcurado = useMemo(() => {
    const map = new Map<string, number>()
    leads.forEach((l) => {
      const nome = l.produto_interesse ? PRODUTO_INTERESSE_LABEL[l.produto_interesse] : 'Não informado'
      map.set(nome, (map.get(nome) ?? 0) + 1)
    })
    return Array.from(map.entries()).map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total)
  }, [leads])

  const categoriaVendida = useMemo(() => {
    const map = new Map<string, { qtd: number; valor: number }>()
    vendas.forEach((v) => {
      (v.itens ?? []).forEach((item) => {
        const produtoField = item.produto
        const categoria = Array.isArray(produtoField) ? produtoField[0]?.categoria : produtoField?.categoria
        const nome = categoria ? (PRODUTO_CATEGORIA_LABEL[categoria] ?? categoria) : 'Outros'
        if (!map.has(nome)) map.set(nome, { qtd: 0, valor: 0 })
        const row = map.get(nome)!
        row.qtd++
        row.valor += item.subtotal
      })
    })
    return Array.from(map.entries())
      .map(([nome, dados]) => ({ nome, qtd: dados.qtd, ticketMedio: dados.qtd > 0 ? dados.valor / dados.qtd : 0 }))
      .sort((a, b) => b.qtd - a.qtd)
  }, [vendas])

  const porVendedor = useMemo(() => {
    return vendedores.map((v) => {
      const leadsDoVendedor = leads.filter((l) => l.vendedor_id === v.id)
      const vendasDoVendedor = vendas.filter((ve) => ve.vendedor_id === v.id)
      const valorVendido = vendasDoVendedor.reduce((s, ve) => s + ve.total, 0)
      const leadsPerdidos = leadsDoVendedor.filter((l) => l.status_funil === 'lead_perdido')
      const motivos = leadsPerdidos.map((l) => l.motivo_perda).filter(Boolean) as string[]
      return {
        id: v.id,
        nome: v.nome,
        leads: leadsDoVendedor.length,
        vendas: vendasDoVendedor.length,
        conversao: leadsDoVendedor.length > 0 ? (vendasDoVendedor.length / leadsDoVendedor.length) * 100 : 0,
        ticketMedio: vendasDoVendedor.length > 0 ? valorVendido / vendasDoVendedor.length : 0,
        comissao: valorVendido * (v.comissao_percentual / 100),
        leadsPerdidosQtd: leadsPerdidos.length,
        motivos,
      }
    }).sort((a, b) => b.vendas - a.vendas)
  }, [vendedores, leads, vendas])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM · Relatórios"
        subtitle="Leads, conversão, origem, produtos e desempenho por vendedor"
        actions={
          <Button variant="secondary" leftIcon={<Download size={14} />} onClick={() => void handleExportarPdf()} loading={exportando}>
            Exportar PDF
          </Button>
        }
      />

      <Card>
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          activePreset={activePreset}
          onChange={({ inicio, fim, preset }) => { setDataInicio(inicio); setDataFim(fim); setActivePreset(preset) }}
        />
      </Card>

      <div id="crm-relatorios-print-area" className="space-y-6 bg-cream-100">
      <Card>
        <CardHeader title="Leads por Período" />
        {leadsSeries.length === 0 ? (
          <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem leads no período" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={leadsSeries} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
              <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
              <Bar dataKey="total" fill="#B8962E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Orçamentos → Venda" value={`${taxaConversaoLeadVenda.toFixed(1)}%`} accent />
        <MetricCard label="Tempo Médio de Fechamento" value={`${tempoMedioFechamento.toFixed(1)} dias`} />
        <MetricCard label="Valor Médio dos Pedidos" value={formatMoney(valorMedioPedido)} />
      </div>

      <Card padding="none">
        <div className="p-5 pb-0"><CardHeader title="Origem dos Leads" subtitle="Comparativo de leads, vendas, conversão e faturamento" /></div>
        {origemComparativo.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem dados no período" /></div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Origem</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Leads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Vendas</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Conversão</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {origemComparativo.map((row) => (
                  <tr key={row.nome} className="hover:bg-[#FAF7F0] transition-colors">
                    <td className="px-5 py-3 font-medium text-dark-700">{row.nome}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{row.leads}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{row.vendas}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{row.conversao.toFixed(0)}%</td>
                    <td className="px-5 py-3 text-right font-medium text-dark-700">{formatMoney(row.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Produto Mais Procurado" subtitle="Interesse declarado pelos leads" />
          {produtoMaisProcurado.length === 0 ? (
            <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem leads no período" />
          ) : (
            <div className="space-y-2">
              {produtoMaisProcurado.map((p) => (
                <div key={p.nome} className="flex items-center justify-between text-sm py-1.5 border-b border-gold-50 last:border-0">
                  <span className="text-dark-600">{p.nome}</span>
                  <span className="font-medium text-dark-700">{p.total}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Produto Mais Vendido" subtitle="Categoria · ticket médio (dados de vendas)" />
          {categoriaVendida.length === 0 ? (
            <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas no período" />
          ) : (
            <div className="space-y-2">
              {categoriaVendida.map((c) => (
                <div key={c.nome} className="flex items-center justify-between text-sm py-1.5 border-b border-gold-50 last:border-0">
                  <span className="text-dark-600">{c.nome}</span>
                  <span className="text-right">
                    <span className="font-medium text-dark-700">{c.qtd}</span>
                    <span className="text-xs text-dark-300 ml-2">{formatMoney(c.ticketMedio)} méd.</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="p-5 pb-0"><CardHeader title="Relatório por Vendedor" /></div>
        {porVendedor.length === 0 ? (
          <div className="px-5 pb-5"><EmptyState imageSrc="/images/Profile Interface-rafiki.svg" title="Nenhum vendedor cadastrado" /></div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Vendedor</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Leads</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Vendas</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Conversão</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Ticket Médio</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Comissão</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Motivos de Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {porVendedor.map((v) => (
                  <tr key={v.id} className="hover:bg-[#FAF7F0] transition-colors">
                    <td className="px-5 py-3 font-medium text-dark-700">{v.nome}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{v.leads}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{v.vendas}</td>
                    <td className="px-5 py-3 text-right text-dark-400">{v.conversao.toFixed(0)}%</td>
                    <td className="px-5 py-3 text-right text-dark-400">{formatMoney(v.ticketMedio)}</td>
                    <td className="px-5 py-3 text-right text-green-700">{formatMoney(v.comissao)}</td>
                    <td className="px-5 py-3 text-dark-400 max-w-[220px]">
                      {v.motivos.length > 0
                        ? <span className="text-xs line-clamp-2">{v.motivos.slice(0, 2).join('; ')}{v.motivos.length > 2 ? `… (+${v.motivos.length - 2})` : ''}</span>
                        : <span className="text-xs text-dark-200">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      </div>
    </div>
  )
}
