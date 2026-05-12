'use client'

import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, CardHeader, MetricCard, Spinner, EmptyState } from '@/components/ui'
import { formatMoney, PRODUTO_CATEGORIA_LABEL } from '@/utils'
import type { ProdutoCategoria } from '@/types'

const CHART_COLORS = ['#B8962E', '#C49A35', '#D4AF5A', '#EBD9A4', '#9A7B22', '#7A5C10', '#5C4208', '#3D2B05']

interface CategoriaData {
  name: string
  value: number
}

interface MesData {
  mes: string
  vendas: number
  despesas: number
}

export default function RelatoriosPage() {
  const [categorias, setCategorias] = useState<CategoriaData[]>([])
  const [meses, setMeses] = useState<MesData[]>([])
  const [totalMes, setTotalMes] = useState(0)
  const [loading, setLoading] = useState(true)

  async function loadRelatorios() {
    const now = new Date()
    const mesInicio = format(startOfMonth(now), 'yyyy-MM-dd')
    const mesFim = format(endOfMonth(now), 'yyyy-MM-dd')

    const [{ data: vendasItens }, { data: lancamentos }] = await Promise.all([
      supabase
        .from('venda_itens')
        .select('subtotal, produto:produtos(categoria)')
        .gte('created_at', mesInicio)
        .lte('created_at', mesFim),
      supabase.from('lancamentos').select('tipo, valor, data_lancamento'),
    ])

    // Categorias do mês
    const catMap: Partial<Record<ProdutoCategoria, number>> = {}
    ;(vendasItens ?? []).forEach((item) => {
      const cat = ((item.produto as unknown) as { categoria: ProdutoCategoria } | null)?.categoria
      if (cat) catMap[cat] = (catMap[cat] ?? 0) + (item.subtotal || 0)
    })
    const catData: CategoriaData[] = Object.entries(catMap).map(([k, v]) => ({
      name: PRODUTO_CATEGORIA_LABEL[k as ProdutoCategoria] ?? k,
      value: v ?? 0,
    })).sort((a, b) => b.value - a.value)
    setCategorias(catData)
    setTotalMes(catData.reduce((s, c) => s + c.value, 0))

    // Últimos 6 meses
    const mesData: MesData[] = Array.from({ length: 6 }, (_, i) => {
      const m = subMonths(now, 5 - i)
      const mStr = format(m, 'yyyy-MM')
      const vendas = (lancamentos ?? [])
        .filter((l) => l.tipo === 'entrada' && l.data_lancamento?.startsWith(mStr))
        .reduce((s, l) => s + l.valor, 0)
      const despesas = (lancamentos ?? [])
        .filter((l) => l.tipo === 'saida' && l.data_lancamento?.startsWith(mStr))
        .reduce((s, l) => s + l.valor, 0)
      return { mes: format(m, 'MMM', { locale: ptBR }), vendas, despesas }
    })
    setMeses(mesData)
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadRelatorios(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" subtitle="Análises e indicadores do negócio" />

      <div className="grid grid-cols-1 gap-4">
        <MetricCard label="Faturamento do Mês (por categorias)" value={formatMoney(totalMes)} accent />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Entradas vs Saídas */}
        <Card>
          <CardHeader title="Entradas vs Despesas — 6 Meses" />
          {meses.every((m) => m.vendas === 0 && m.despesas === 0) ? (
            <EmptyState icon={<BarChart3 size={24} />} title="Sem dados para o período" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={meses} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EBD9A4" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9C8B72' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v, name) => [formatMoney(Number(v)), name === 'vendas' ? 'Entradas' : 'Despesas']}
                  contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
                <Bar dataKey="vendas" fill="#B8962E" radius={[3, 3, 0, 0]} name="Entradas" />
                <Bar dataKey="despesas" fill="#C4B09A" radius={[3, 3, 0, 0]} name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Vendas por Categoria */}
        <Card>
          <CardHeader title="Vendas por Categoria — Mês Atual" />
          {categorias.length === 0 ? (
            <EmptyState icon={<BarChart3 size={24} />} title="Sem vendas neste mês" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categorias} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {categorias.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatMoney(Number(v))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #EBD9A4', fontSize: 12 }} />
                <Legend formatter={(value) => <span style={{ fontSize: 11, color: '#6B5B45' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>
    </div>
  )
}
