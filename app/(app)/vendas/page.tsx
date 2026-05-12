'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, ShoppingCart, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, Button, SearchInput, Select, Spinner, EmptyState,
  ConfirmDialog, ActionMenu,
} from '@/components/ui'
import { ModalNovaVenda } from '@/components/modals/modal-nova-venda'
import { ModalEditarVenda } from '@/components/modals/modal-editar-venda'
import { DrawerDetalheVenda } from '@/components/vendas/drawer-detalhe-venda'
import { deleteVenda } from '@/services/vendas'
import {
  formatMoney, formatDate, vendaStatusVariant,
  VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
} from '@/utils'
import type { Venda, VendaStatus, ClienteResumo } from '@/types'

export type VendaRow = Venda & {
  cliente?: ClienteResumo | null
  itens?: {
    id: string
    produto_id: string
    variacao_id: string | null
    nome_produto: string
    descricao: string | null
    quantidade: number
    preco_unitario: number
    custo_unitario: number
    desconto: number
    subtotal: number
    produto?: {
      codigo: string
      categoria: string
      material: string | null
    } | null
    variacao?: {
      nome: string
      valor: string
    } | null
  }[]
}

export default function VendasPage() {
  const [vendas, setVendas] = useState<VendaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<VendaStatus | ''>('')
  const [deletando, setDeletando] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<VendaRow | null>(null)
  const [editando, setEditando] = useState<VendaRow | null>(null)
  const [modalNovaVenda, setModalNovaVenda] = useState(false)
  const [drawerVenda, setDrawerVenda] = useState<VendaRow | null>(null)

  const loadVendas = useCallback(async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select(`
        *,
        cliente:clientes(nome, telefone),
        itens:venda_itens(
          id,
          produto_id,
          variacao_id,
          nome_produto,
          descricao,
          quantidade,
          preco_unitario,
          custo_unitario,
          desconto,
          subtotal,
          produto:produtos(codigo, categoria, material),
          variacao:produto_variacoes(nome, valor)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar vendas.')
    } else {
      setVendas((data as VendaRow[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadVendas(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadVendas])

  // Sequential display numbers based on creation order (stable, gap-free)
  const displayNumMap = useMemo(() => {
    const sorted = [...vendas].sort((a, b) => a.numero - b.numero)
    return new Map(sorted.map((v, i) => [v.id, i + 1]))
  }, [vendas])

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const matchSearch = !search ||
        v.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        String(v.numero).includes(search) ||
        v.itens?.some((i) =>
          i.nome_produto.toLowerCase().includes(search.toLowerCase()) ||
          i.produto?.codigo.toLowerCase().includes(search.toLowerCase()) ||
          i.variacao?.valor.toLowerCase().includes(search.toLowerCase()),
        )
      const matchStatus = !filtroStatus || v.status === filtroStatus
      return matchSearch && matchStatus
    })
  }, [vendas, search, filtroStatus])

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(confirmDelete.id)
    const { error } = await deleteVenda(confirmDelete.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Venda excluída.')
      setVendas((prev) => prev.filter((v) => v.id !== confirmDelete.id))
    }
    setDeletando(null)
    setConfirmDelete(null)
  }

  function handleEditSuccess(updated: Partial<VendaRow>) {
    setVendas((prev) =>
      prev.map((v) => v.id === editando?.id ? { ...v, ...updated } : v),
    )
  }

  return (
    <div>
      <PageHeader
        title="Vendas"
        subtitle="Gerenciamento de vendas e pedidos"
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => setModalNovaVenda(true)}
          >
            Nova Venda
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente, nº ou produto..."
            className="flex-1"
          />
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as VendaStatus | '')}
            placeholder="Todos os status"
            className="w-full sm:w-44"
          >
            {(Object.keys(VENDA_STATUS_LABEL) as VendaStatus[]).map((s) => (
              <option key={s} value={s}>{VENDA_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} />}
            title="Nenhuma venda encontrada"
            description={search || filtroStatus ? 'Tente ajustar os filtros.' : 'Registre a primeira venda.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((venda) => {
                const numItens = venda.itens?.length ?? 0
                const totalUnidades = (venda.itens ?? []).reduce((s, i) => s + i.quantidade, 0)
                return (
                  <div
                    key={venda.id}
                    className="p-4 hover:bg-cream-50/30 transition-colors cursor-pointer active:bg-cream-100"
                    onClick={() => setDrawerVenda(venda)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded">
                            #{displayNumMap.get(venda.id)}
                          </span>
                          <p className="font-medium text-dark-700 text-sm truncate">
                            {venda.cliente?.nome || <span className="text-dark-300 italic">Sem cliente</span>}
                          </p>
                        </div>
                        <p className="text-xs text-dark-400 mt-1">
                          {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento]}
                          {numItens > 0 && (
                            <span className="text-dark-300"> · {totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'}</span>
                          )}
                        </p>
                        <p className="text-xs text-dark-300 mt-0.5">{formatDate(venda.data_venda)}</p>
                        {(venda.itens ?? []).length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {(venda.itens ?? []).slice(0, 2).map((item) => (
                              <p key={item.id} className="text-[11px] text-dark-400 truncate">
                                <span className="font-semibold text-dark-600">{item.quantidade}×</span> {item.nome_produto}
                              </p>
                            ))}
                            {(venda.itens ?? []).length > 2 && (
                              <p className="text-[11px] text-dark-300 italic">
                                +{(venda.itens ?? []).length - 2} mais
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <ActionMenu
                        items={[
                          { label: 'Editar', icon: <Pencil size={14} />, onClick: () => { setEditando(venda) } },
                          { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => { setConfirmDelete(venda) }, variant: 'danger' },
                        ]}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gold-50">
                      <Badge variant={vendaStatusVariant(venda.status)}>
                        {VENDA_STATUS_LABEL[venda.status]}
                      </Badge>
                      <div className="text-right">
                        {venda.desconto > 0 && (
                          <p className="text-[10px] text-red-400 leading-none mb-0.5">
                            −{formatMoney(venda.desconto)}
                          </p>
                        )}
                        <span className="font-medium text-dark-700">{formatMoney(venda.total)}</span>
                      </div>
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
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide w-14">#</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Itens</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Data</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Pagamento</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((venda) => {
                    const numItens = venda.itens?.length ?? 0
                    const totalUnidades = (venda.itens ?? []).reduce((s, i) => s + i.quantidade, 0)
                    return (
                      <tr
                        key={venda.id}
                        className="hover:bg-cream-50/40 transition-colors group cursor-pointer"
                        onClick={() => setDrawerVenda(venda)}
                      >
                        <td className="px-5 py-3 text-dark-400 font-mono text-xs">#{displayNumMap.get(venda.id)}</td>
                        <td className="px-5 py-3 max-w-[180px]">
                          <p className="font-medium text-dark-700 truncate">
                            {venda.cliente?.nome || <span className="text-dark-300 italic font-normal">Sem cliente</span>}
                          </p>
                          {/* Items preview on hover/always visible */}
                          {(venda.itens ?? []).length > 0 && (
                            <div className="mt-0.5 space-y-px">
                              {(venda.itens ?? []).slice(0, 2).map((item) => (
                                <p key={item.id} className="text-[11px] text-dark-400 truncate leading-tight">
                                  {item.quantidade}× {item.nome_produto}
                                </p>
                              ))}
                              {(venda.itens ?? []).length > 2 && (
                                <p className="text-[11px] text-dark-300 italic leading-tight">
                                  +{(venda.itens ?? []).length - 2} mais
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-dark-400">
                          <div className="flex flex-col gap-1 max-w-[320px]">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-[11px] font-medium bg-cream-100 border border-gold-100 rounded-full text-dark-500">
                                {numItens}
                              </span>
                              <span className="text-xs text-dark-400">
                                {totalUnidades} {totalUnidades === 1 ? 'unidade' : 'unidades'} vendidas
                              </span>
                            </div>
                            {(venda.itens ?? []).slice(0, 3).map((item) => (
                              <p key={item.id} className="text-[11px] text-dark-400 truncate leading-tight">
                                <span className="font-semibold text-dark-600">{item.quantidade}x</span> {item.nome_produto}
                                {item.variacao && (
                                  <span className="text-dark-300"> - {item.variacao.nome}: {item.variacao.valor}</span>
                                )}
                              </p>
                            ))}
                            {(venda.itens ?? []).length > 3 && (
                              <p className="text-[11px] text-dark-300 italic leading-tight">
                                +{(venda.itens ?? []).length - 3} mais
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(venda.data_venda)}</td>
                        <td className="hidden lg:table-cell px-5 py-3 text-dark-400">
                          {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento]}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {venda.desconto > 0 && (
                            <p className="text-[10px] text-red-400 leading-none mb-0.5">
                              −{formatMoney(venda.desconto)}
                            </p>
                          )}
                          <span className="font-medium text-dark-700">{formatMoney(venda.total)}</span>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={vendaStatusVariant(venda.status)}>
                            {VENDA_STATUS_LABEL[venda.status]}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditando(venda)
                              }}
                              className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar venda"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                setConfirmDelete(venda)
                              }}
                              className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Excluir venda"
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

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir venda"
        description={`Deseja excluir a venda #${confirmDelete ? displayNumMap.get(confirmDelete.id) : ''}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={!!deletando}
      />

      <ModalNovaVenda
        open={modalNovaVenda}
        onClose={() => setModalNovaVenda(false)}
        onSuccess={() => { void loadVendas() }}
      />

      <ModalEditarVenda
        open={!!editando}
        onClose={() => setEditando(null)}
        onSuccess={handleEditSuccess}
        venda={editando}
        displayNum={editando ? displayNumMap.get(editando.id) : undefined}
      />

      <DrawerDetalheVenda
        open={!!drawerVenda}
        onClose={() => setDrawerVenda(null)}
        venda={drawerVenda}
        displayNum={drawerVenda ? displayNumMap.get(drawerVenda.id) : undefined}
        onEditar={() => {
          if (!drawerVenda) return
          setEditando(drawerVenda)
          setDrawerVenda(null)
        }}
        onExcluir={() => {
          if (!drawerVenda) return
          setConfirmDelete(drawerVenda)
          setDrawerVenda(null)
        }}
      />
    </div>
  )
}
