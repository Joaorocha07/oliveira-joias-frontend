'use client'

import { useEffect, useMemo, useState } from 'react'
import { format, parseISO, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, EmptyState, MetricCard, Spinner } from '@/components/ui'
import { resumoFolhaPorMes } from '@/services/folha'
import { formatMoney } from '@/utils'
import type { FolhaResumoMensal } from '@/types'

const SERIES = [
  { key: 'salarios', label: 'Salários', color: '#B8962E' },
  { key: 'comissoes', label: 'Comissões', color: '#D4B85A' },
  { key: 'outrosProventos', label: 'Outros proventos', color: '#9C8B72' },
] as const

const numberFormat = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))

interface RelatorioFolhaProps {
  /** Mês final do relatório (yyyy-MM-01); mostra os 12 meses até ele. */
  mesFim: string
}

export function RelatorioFolha({ mesFim }: RelatorioFolhaProps) {
  const mesInicio = format(subMonths(parseISO(mesFim), 11), 'yyyy-MM-01')
  const [resultado, setResultado] = useState<{ chave: string; data: FolhaResumoMensal[]; error: string | null } | null>(null)
  const chave = `${mesInicio}:${mesFim}`

  useEffect(() => {
    let cancelado = false
    resumoFolhaPorMes(mesInicio, mesFim).then(({ data, error }) => {
      if (!cancelado) setResultado({ chave: `${mesInicio}:${mesFim}`, data, error })
    })
    return () => { cancelado = true }
  }, [mesInicio, mesFim])

  const carregando = resultado?.chave !== chave
  const dados = useMemo(() => (carregando ? [] : resultado?.data ?? []), [carregando, resultado])
  const totais = useMemo(() => dados.reduce(
    (acc, r) => ({ bruto: acc.bruto + r.salarios + r.comissoes + r.outrosProventos, liquido: acc.liquido + r.liquido, pago: acc.pago + r.pago, comissoes: acc.comissoes + r.comissoes }),
    { bruto: 0, liquido: 0, pago: 0, comissoes: 0 },
  ), [dados])
  const serie = dados.map((r) => ({ ...r, periodo: format(parseISO(r.mes), 'MMM/yy', { locale: ptBR }) }))

  if (carregando) {
    return <Card><div className="flex h-40 items-center justify-center"><Spinner size={28} /></div></Card>
  }
  if (resultado?.error) {
    return <Card><p className="py-10 text-center text-sm text-[#C75B5B]">{resultado.error}</p></Card>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Custo bruto (12 meses)" value={formatMoney(totais.bruto)} accent />
        <MetricCard label="Comissões (12 meses)" value={formatMoney(totais.comissoes)} />
        <MetricCard label="Líquido (12 meses)" value={formatMoney(totais.liquido)} />
        <MetricCard
          label="Já pago"
          value={formatMoney(totais.pago)}
          change={totais.liquido > totais.pago ? `${formatMoney(totais.liquido - totais.pago)} em aberto` : 'Tudo pago'}
          changeType={totais.liquido > totais.pago ? 'down' : 'up'}
        />
      </div>

      <Card>
        <p className="text-sm font-semibold text-dark-700 mb-3">Custo da folha por mês</p>
        {serie.length === 0 ? (
          <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Nenhuma folha gerada no período" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={serie} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
              <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} tickFormatter={numberFormat} />
              <Tooltip
                formatter={(value, name) => [formatMoney(Number(value)), SERIES.find((s) => s.key === name)?.label ?? name]}
                contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }}
              />
              <Legend formatter={(name) => SERIES.find((s) => s.key === name)?.label ?? name} wrapperStyle={{ fontSize: 12 }} />
              {SERIES.map((s, i) => (
                <Bar key={s.key} dataKey={s.key} stackId="folha" fill={s.color} radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {serie.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-dark-400">
                <th className="py-2 pr-3">Mês</th>
                <th className="py-2 px-3 text-right">Pessoas</th>
                <th className="py-2 px-3 text-right">Salários</th>
                <th className="py-2 px-3 text-right">Comissões</th>
                <th className="py-2 px-3 text-right">Outros</th>
                <th className="py-2 px-3 text-right">Descontos</th>
                <th className="py-2 px-3 text-right">Líquido</th>
                <th className="py-2 pl-3 text-right">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gold-50">
              {[...serie].reverse().map((r) => (
                <tr key={r.mes} className="tabular-nums">
                  <td className="py-2 pr-3 capitalize text-dark-700">{r.periodo}</td>
                  <td className="py-2 px-3 text-right">{r.funcionarios}</td>
                  <td className="py-2 px-3 text-right">{formatMoney(r.salarios)}</td>
                  <td className="py-2 px-3 text-right">{formatMoney(r.comissoes)}</td>
                  <td className="py-2 px-3 text-right">{formatMoney(r.outrosProventos)}</td>
                  <td className="py-2 px-3 text-right text-[#C75B5B]">{formatMoney(r.descontos)}</td>
                  <td className="py-2 px-3 text-right font-semibold">{formatMoney(r.liquido)}</td>
                  <td className="py-2 pl-3 text-right text-[#5B8C5B]">{formatMoney(r.pago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
