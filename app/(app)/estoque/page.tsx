'use client'

import { useState, useEffect, useMemo } from 'react'
import { Diamond } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, SearchInput, Select, Spinner, EmptyState,
} from '@/components/ui'
import { formatMoney, PRODUTO_CATEGORIA_LABEL } from '@/utils'
import type { VwEstoqueAtual, ProdutoCategoria } from '@/types'

export default function EstoquePage() {
  const [estoque, setEstoque] = useState<VwEstoqueAtual[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<ProdutoCategoria | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<'normal' | 'critico' | 'esgotado' | ''>('')

  async function loadEstoque() {
    const { data, error } = await supabase
      .from('vw_estoque_atual')
      .select('*')
      .order('produto_nome')

    if (error) {
      toast.error('Erro ao carregar estoque.')
    } else {
      setEstoque(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadEstoque(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const filtered = useMemo(() => {
    return estoque.filter((item) => {
      const matchSearch = !search ||
        item.produto_nome.toLowerCase().includes(search.toLowerCase()) ||
        item.codigo.toLowerCase().includes(search.toLowerCase()) ||
        (item.material ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCategoria = !filtroCategoria || item.categoria === filtroCategoria
      const matchStatus = !filtroStatus || item.status_estoque === filtroStatus
      return matchSearch && matchCategoria && matchStatus
    })
  }, [estoque, search, filtroCategoria, filtroStatus])

  function statusVariant(status: VwEstoqueAtual['status_estoque']) {
    if (status === 'esgotado') return 'danger' as const
    if (status === 'critico') return 'warning' as const
    return 'success' as const
  }

  function statusLabel(status: VwEstoqueAtual['status_estoque']) {
    if (status === 'esgotado') return 'Esgotado'
    if (status === 'critico') return 'Crítico'
    return 'Normal'
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Controle de produtos e variações"
      />

      <Card padding="none">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por produto, código..."
            className="flex-1"
          />
          <Select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value as ProdutoCategoria | '')}
            placeholder="Todas as categorias"
            className="w-full sm:w-48"
          >
            {(Object.keys(PRODUTO_CATEGORIA_LABEL) as ProdutoCategoria[]).map((c) => (
              <option key={c} value={c}>{PRODUTO_CATEGORIA_LABEL[c]}</option>
            ))}
          </Select>
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as 'normal' | 'critico' | 'esgotado' | '')}
            placeholder="Todos os status"
            className="w-full sm:w-40"
          >
            <option value="normal">Normal</option>
            <option value="critico">Crítico</option>
            <option value="esgotado">Esgotado</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Diamond size={24} />}
            title="Nenhum produto encontrado"
            description="Ajuste os filtros ou cadastre produtos no sistema."
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((item) => (
                <div key={item.variacao_id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-dark-700 text-sm truncate">{item.produto_nome}</p>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {item.variacao_nome}: {item.variacao_valor}
                      </p>
                      <p className="text-xs text-dark-300 mt-0.5 font-mono">{item.codigo}</p>
                    </div>
                    <Badge variant={statusVariant(item.status_estoque)} className="flex-shrink-0">
                      {statusLabel(item.status_estoque)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50">
                    <span className="text-xs text-dark-400">
                      Estoque:{' '}
                      <span className={item.status_estoque !== 'normal' ? 'text-red-600 font-medium' : 'text-dark-700 font-medium'}>
                        {item.estoque_atual}
                      </span>
                      <span className="text-dark-300"> / {item.estoque_minimo}</span>
                    </span>
                    <span className="text-xs font-medium text-dark-600">{formatMoney(item.preco_venda)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Código</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Produto</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Categoria</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Variação</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Estoque</th>
                    <th className="hidden md:table-cell text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Preço</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((item) => (
                    <tr key={item.variacao_id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 font-mono text-xs">{item.codigo}</td>
                      <td className="px-5 py-3 font-medium text-dark-700 max-w-[200px]">
                        <span className="block truncate">{item.produto_nome}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">
                        {PRODUTO_CATEGORIA_LABEL[item.categoria]}
                      </td>
                      <td className="px-5 py-3 text-dark-400">
                        {item.variacao_nome}: {item.variacao_valor}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={item.status_estoque !== 'normal' ? 'text-red-600 font-medium' : 'text-dark-700'}>
                          {item.estoque_atual}
                        </span>
                        <span className="text-dark-300"> / {item.estoque_minimo}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-right text-dark-700">{formatMoney(item.preco_venda)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant(item.status_estoque)}>
                          {statusLabel(item.status_estoque)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
