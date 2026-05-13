'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Diamond, Pencil, Trash2, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, MetricCard, Button, SearchInput, Select,
  Spinner, EmptyState, ActionMenu, AlertDialog, PeriodFilter, getPeriodRange, type PeriodPreset,
} from '@/components/ui'
import { ModalProduto } from '@/components/modals/modal-produto'
import { ModalMovimentacaoEstoque } from '@/components/modals/modal-movimentacao-estoque'
import { formatMoney, PRODUTO_CATEGORIA_LABEL } from '@/utils'
import { deleteProduto, desativarProduto } from '@/services/produtos'
import type { Produto, ProdutoCategoria } from '@/types'

interface ProdutoComEstoque extends Produto {
  total_estoque: number
  variacoes_ativas: number
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<ProdutoComEstoque[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<ProdutoCategoria | ''>('')
  const [filtroAtivo, setFiltroAtivo] = useState<'true' | 'false' | ''>('true')
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [modalProduto, setModalProduto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [modalMovimentacao, setModalMovimentacao] = useState(false)
  const [movimentandoProduto, setMovimentandoProduto] = useState<{ id: string; nome: string } | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<ProdutoComEstoque | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deactivateOpen, setDeactivateOpen] = useState(false)

  const loadProdutos = useCallback(async () => {
    const { data, error } = await supabase
      .from('produtos')
      .select('*, variacoes:produto_variacoes(*), fornecedor:fornecedores(nome)')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('nome')

    if (error) {
      toast.error('Erro ao carregar produtos.')
      setLoading(false)
      return
    }

    const enriched: ProdutoComEstoque[] = (data ?? []).map((p: Produto & { variacoes: Produto['variacoes'] }) => {
      const variacoes = p.variacoes ?? []
      const ativas = variacoes.filter((v) => v.ativo)
      const total = ativas.reduce((sum, v) => sum + (v.estoque_atual ?? 0), 0)
      return { ...p, total_estoque: total, variacoes_ativas: ativas.length }
    })

    setProdutos(enriched)
    setLoading(false)
  }, [dataFim, dataInicio])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadProdutos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadProdutos])

  const minEstoque = useCallback((p: ProdutoComEstoque) => {
    const variacoes = p.variacoes ?? []
    return variacoes.filter((v) => v.ativo).reduce((sum, v) => sum + (v.estoque_minimo ?? 0), 0)
  }, [])

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const matchSearch = !search ||
        p.nome.toLowerCase().includes(search.toLowerCase()) ||
        p.codigo.toLowerCase().includes(search.toLowerCase()) ||
        (p.material ?? '').toLowerCase().includes(search.toLowerCase())
      const matchCategoria = !filtroCategoria || p.categoria === filtroCategoria
      const matchAtivo = !filtroAtivo || String(p.ativo) === filtroAtivo
      return matchSearch && matchCategoria && matchAtivo
    })
  }, [produtos, search, filtroCategoria, filtroAtivo])

  const metricas = useMemo(() => {
    const ativos = produtos.filter((p) => p.ativo)
    let critico = 0; let esgotado = 0

    ativos.forEach((p) => {
      const min = minEstoque(p)
      if (p.total_estoque === 0) esgotado++
      else if (p.total_estoque <= min) critico++
    })

    return {
      totalProdutos: ativos.length,
      totalUnidades: ativos.reduce((s, p) => s + p.total_estoque, 0),
      critico,
      esgotado,
    }
  }, [produtos, minEstoque])

  function openCreate() { setEditando(null); setModalProduto(true) }
  function openEdit(p: Produto) { setEditando(p); setModalProduto(true) }
  function openMovimentacao(p: ProdutoComEstoque) {
    setMovimentandoProduto({ id: p.id, nome: p.nome })
    setModalMovimentacao(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await deleteProduto(deleteTarget.id)

    if (error === 'HAS_DEPENDENCIES') {
      setDeleteLoading(false)
      setDeactivateOpen(true)
      return
    }

    if (error) {
      toast.error('Erro ao excluir produto.')
    } else {
      toast.success('Produto excluído.')
      setProdutos((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
    setDeleteLoading(false)
  }

  async function handleDesativar() {
    if (!deleteTarget) return
    setDeleteLoading(true)
    const { error } = await desativarProduto(deleteTarget.id)
    if (error) {
      toast.error('Erro ao desativar produto.')
    } else {
      toast.success('Produto desativado.')
      setProdutos((prev) => prev.map((p) => p.id === deleteTarget.id ? { ...p, ativo: false } : p))
    }
    setDeleteLoading(false)
    setDeactivateOpen(false)
    setDeleteTarget(null)
  }

  function stockBadge(estoque: number, minimo: number) {
    if (estoque === 0) return { variant: 'danger' as const, label: 'Esgotado' }
    if (estoque <= minimo) return { variant: 'warning' as const, label: 'Crítico' }
    return { variant: 'success' as const, label: 'Normal' }
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Cadastro e controle de produtos"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Produto
          </Button>
        }
      />

      {!loading && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Produtos Ativos" value={String(metricas.totalProdutos)} />
            <MetricCard label="Total em Estoque" value={`${metricas.totalUnidades} un`} />
            <MetricCard label="Estoque Crítico" value={String(metricas.critico)} changeType={metricas.critico > 0 ? 'down' : 'neutral'} />
            <MetricCard label="Esgotados" value={String(metricas.esgotado)} changeType={metricas.esgotado > 0 ? 'down' : 'neutral'} accent={metricas.esgotado > 0} />
          </div>
        </>
      )}

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
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
          <div className="flex flex-col sm:flex-row gap-3">
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
            value={filtroAtivo}
            onChange={(e) => setFiltroAtivo(e.target.value as 'true' | 'false' | '')}
            placeholder="Todos"
            className="w-full sm:w-36"
          >
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Diamond size={24} />}
            title="Nenhum produto encontrado"
            description="Ajuste os filtros ou cadastre o primeiro produto."
            action={!search && !filtroCategoria && (
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>
                Novo Produto
              </Button>
            )}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((p) => {
                const { variant, label } = stockBadge(p.total_estoque, minEstoque(p))
                return (
                  <div key={p.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded flex-shrink-0">
                            {p.codigo}
                          </span>
                          {!p.ativo && <span className="text-[10px] text-dark-300 italic">inativo</span>}
                        </div>
                        <p className="font-medium text-dark-700 text-sm truncate">{p.nome}</p>
                        <p className="text-xs text-dark-400 mt-0.5">
                          {PRODUTO_CATEGORIA_LABEL[p.categoria]}
                          {p.material && <> · {p.material}</>}
                        </p>
                      </div>
                      <ActionMenu
                        items={[
                          { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(p) },
                          { label: 'Movimentar Estoque', icon: <ArrowUpDown size={14} />, onClick: () => openMovimentacao(p) },
                          { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setDeleteTarget(p), variant: 'danger' },
                        ]}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50">
                      <div className="flex items-center gap-2">
                        <Badge variant={variant}>{label}</Badge>
                        <span className="text-xs text-dark-400">{p.total_estoque} un · {p.variacoes_ativas} var.</span>
                      </div>
                      <span className="text-xs font-medium text-dark-600">{formatMoney(p.preco_venda)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Código</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Produto</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Categoria</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Variações</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Estoque</th>
                    <th className="hidden md:table-cell text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Preço</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((p) => {
                    const { variant, label } = stockBadge(p.total_estoque, minEstoque(p))
                    return (
                      <tr key={p.id} className="hover:bg-cream-50/40 transition-colors">
                        <td className="px-5 py-3 text-dark-400 font-mono text-xs">{p.codigo}</td>
                        <td className="px-5 py-3 font-medium text-dark-700 max-w-[200px]">
                          <span className="block truncate">{p.nome}</span>
                          {!p.ativo && <span className="text-[10px] text-dark-300 italic">inativo</span>}
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-dark-400">
                          {PRODUTO_CATEGORIA_LABEL[p.categoria]}
                        </td>
                        <td className="hidden lg:table-cell px-5 py-3 text-dark-400 text-center">
                          {p.variacoes_ativas}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={p.total_estoque === 0 ? 'text-red-600 font-medium' : p.total_estoque <= minEstoque(p) ? 'text-amber-600 font-medium' : 'text-dark-700'}>
                            {p.total_estoque}
                          </span>
                          <span className="text-dark-300"> un</span>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-right text-dark-700">
                          {formatMoney(p.preco_venda)}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={variant}>{label}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => openMovimentacao(p)}
                              className="p-1.5 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-100 transition-colors"
                              title="Movimentar estoque"
                            >
                              <ArrowUpDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEdit(p)}
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar produto"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir produto"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <ModalProduto
        open={modalProduto}
        onClose={() => { setModalProduto(false); setEditando(null) }}
        onSuccess={() => { void loadProdutos() }}
        produto={editando}
      />

      <ModalMovimentacaoEstoque
        open={modalMovimentacao}
        onClose={() => { setModalMovimentacao(false); setMovimentandoProduto(undefined) }}
        onSuccess={() => { void loadProdutos() }}
        produtoId={movimentandoProduto?.id}
        produtoNome={movimentandoProduto?.nome}
      />

      <AlertDialog
        open={!!deleteTarget && !deactivateOpen}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        iconVariant="danger"
        title="Excluir produto?"
        description={`Deseja excluir "${deleteTarget?.nome}"? Esta ação é irreversível.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleteLoading}
      />

      <AlertDialog
        open={deactivateOpen}
        onClose={() => { setDeactivateOpen(false); setDeleteTarget(null) }}
        onConfirm={handleDesativar}
        iconVariant="warning"
        title="Produto com vínculos"
        description={`"${deleteTarget?.nome}" possui vendas, compras ou movimentações registradas e não pode ser excluído. Deseja desativá-lo?`}
        confirmLabel="Desativar"
        cancelLabel="Cancelar"
        loading={deleteLoading}
      />
    </div>
  )
}
