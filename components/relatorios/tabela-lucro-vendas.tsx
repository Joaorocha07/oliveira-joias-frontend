'use client'

import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Badge, Button, Card, CardHeader, EmptyState, Pagination } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { formatDate, formatMoney, exportarCsv } from '@/utils'
import type { AnaliseLucroVenda } from '@/types'

export interface LinhaLucroVenda {
  id: string
  numero: number
  data: string
  cliente: string
  tipo: 'normal' | 'livre'
  crediario: boolean
  analise: AnaliseLucroVenda
}

type Ordenacao = 'data' | 'lucro' | 'margem'

const ORDENACOES: { key: Ordenacao; label: string }[] = [
  { key: 'data', label: 'Mais recentes' },
  { key: 'lucro', label: 'Maior lucro' },
  { key: 'margem', label: 'Menor margem' },
]

// Tabela do relatório de Vendas com faturamento, CMV, custos adicionais e lucro líquido de cada venda.
// Mostra o valor integral da venda (inclusive crediário), não o rateio por recebimento usado nos cards.
export function TabelaLucroVendas({ linhas }: { linhas: LinhaLucroVenda[] }) {
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('data')

  const ordenadas = useMemo(() => {
    const copia = [...linhas]
    if (ordenacao === 'lucro') return copia.sort((a, b) => b.analise.lucro - a.analise.lucro)
    if (ordenacao === 'margem') return copia.sort((a, b) => a.analise.margem - b.analise.margem)
    return copia.sort((a, b) => b.data.localeCompare(a.data) || b.numero - a.numero)
  }, [linhas, ordenacao])

  const totais = useMemo(() => linhas.reduce((acc, l) => ({
    faturamento: acc.faturamento + l.analise.faturamento,
    custoProdutos: acc.custoProdutos + l.analise.custoProdutos,
    custosAdicionais: acc.custosAdicionais + l.analise.custosAdicionais,
    lucro: acc.lucro + l.analise.lucro,
  }), { faturamento: 0, custoProdutos: 0, custosAdicionais: 0, lucro: 0 }), [linhas])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(ordenadas)

  function handleExport() {
    exportarCsv(
      'lucro-por-venda',
      ['Data', 'Venda', 'Cliente', 'Tipo', 'Faturamento', 'Custo produtos', 'Custos adicionais', 'Lucro líquido', 'Margem %'],
      ordenadas.map((l) => [
        formatDate(l.data), l.numero, l.cliente, l.tipo === 'livre' ? 'Livre' : 'Normal',
        l.analise.faturamento.toFixed(2), l.analise.custoProdutos.toFixed(2), l.analise.custosAdicionais.toFixed(2),
        l.analise.lucro.toFixed(2), l.analise.margem.toFixed(1),
      ]),
    )
  }

  const corLucro = (v: number) => (v >= 0 ? 'text-[#5B8C5B]' : 'text-[#C75B5B]')

  return (
    <Card padding="none">
      <div className="flex flex-col gap-3 border-b border-gold-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <CardHeader title="Lucro por Venda" subtitle="Faturamento, custo dos produtos, custos adicionais e lucro líquido de cada venda" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-gold-200 text-xs">
            {ORDENACOES.map((o, i) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setOrdenacao(o.key)}
                className={`px-3 py-1.5 transition-colors ${i > 0 ? 'border-l border-gold-200' : ''} ${
                  ordenacao === o.key ? 'bg-gold-100 font-medium text-dark-700' : 'text-dark-400 hover:bg-gold-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Download size={13} />} onClick={handleExport} disabled={linhas.length === 0}>
            CSV
          </Button>
        </div>
      </div>

      {linhas.length === 0 ? (
        <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Sem vendas no período" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50 text-xs uppercase tracking-wide text-dark-300">
                  <th className="px-4 py-3 text-left font-medium">Venda</th>
                  <th className="hidden px-4 py-3 text-left font-medium md:table-cell">Cliente</th>
                  <th className="px-4 py-3 text-right font-medium">Faturamento</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Custo produtos</th>
                  <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">Custos adic.</th>
                  <th className="px-4 py-3 text-right font-medium">Lucro líquido</th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Margem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {paginated.map((l) => (
                  <tr key={l.id} className="hover:bg-cream-50/40">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-dark-500">#{l.numero}</span>
                        {l.tipo === 'livre' && <Badge variant="warning" className="px-1 py-0 text-[9px]">Livre</Badge>}
                        {l.crediario && <Badge variant="info" className="px-1 py-0 text-[9px]">Crediário</Badge>}
                      </div>
                      <p className="text-[11px] text-dark-300">{formatDate(l.data)}</p>
                    </td>
                    <td className="hidden max-w-[180px] px-4 py-2.5 text-dark-600 md:table-cell">
                      <span className="block truncate">{l.cliente}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-dark-700">{formatMoney(l.analise.faturamento)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-dark-500 lg:table-cell">{formatMoney(l.analise.custoProdutos)}</td>
                    <td className="hidden px-4 py-2.5 text-right tabular-nums text-dark-500 lg:table-cell">{formatMoney(l.analise.custosAdicionais)}</td>
                    <td className={`px-4 py-2.5 text-right font-medium tabular-nums ${corLucro(l.analise.lucro)}`}>{formatMoney(l.analise.lucro)}</td>
                    <td className={`hidden px-4 py-2.5 text-right tabular-nums sm:table-cell ${corLucro(l.analise.lucro)}`}>
                      {l.analise.faturamento > 0 ? `${l.analise.margem.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gold-200 bg-cream-50/60 font-medium text-dark-700">
                  <td className="px-4 py-3" colSpan={1}>Total ({linhas.length})</td>
                  <td className="hidden md:table-cell" />
                  <td className="px-4 py-3 text-right tabular-nums">{formatMoney(totais.faturamento)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{formatMoney(totais.custoProdutos)}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums lg:table-cell">{formatMoney(totais.custosAdicionais)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${corLucro(totais.lucro)}`}>{formatMoney(totais.lucro)}</td>
                  <td className={`hidden px-4 py-3 text-right tabular-nums sm:table-cell ${corLucro(totais.lucro)}`}>
                    {totais.faturamento > 0 ? `${((totais.lucro / totais.faturamento) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
        </>
      )}
    </Card>
  )
}
