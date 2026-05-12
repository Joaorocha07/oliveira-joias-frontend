'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, ShoppingCart, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, Button, SearchInput, Select, Spinner, EmptyState, ConfirmDialog, ActionMenu,
} from '@/components/ui'
import { ModalNovaVenda } from '@/components/modals/modal-nova-venda'
import { deleteVenda } from '@/services/vendas'
import { formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { VendaComCliente, VendaStatus } from '@/types'

export default function VendasPage() {
  const [vendas, setVendas] = useState<VendaComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<VendaStatus | ''>('')
  const [deletando, setDeletando] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<VendaComCliente | null>(null)
  const [modalNovaVenda, setModalNovaVenda] = useState(false)

  const loadVendas = useCallback(async () => {
    const { data, error } = await supabase
      .from('vendas')
      .select('*, cliente:clientes(nome, telefone)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar vendas.')
    } else {
      setVendas((data as VendaComCliente[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadVendas(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadVendas])

  const filtered = useMemo(() => {
    return vendas.filter((v) => {
      const matchSearch = !search ||
        v.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        String(v.numero).includes(search)
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
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente ou nº..."
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
              {filtered.map((venda) => (
                <div key={venda.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded">
                          #{venda.numero}
                        </span>
                        <p className="font-medium text-dark-700 text-sm truncate">
                          {venda.cliente?.nome || <span className="text-dark-300 italic">Sem cliente</span>}
                        </p>
                      </div>
                      <p className="text-xs text-dark-300 mt-1 pl-0.5">{formatDate(venda.data_venda)}</p>
                    </div>
                    <ActionMenu
                      items={[{
                        label: 'Excluir',
                        icon: <Trash2 size={14} />,
                        onClick: () => setConfirmDelete(venda),
                        variant: 'danger',
                      }]}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-gold-50">
                    <Badge variant={vendaStatusVariant(venda.status)}>
                      {VENDA_STATUS_LABEL[venda.status]}
                    </Badge>
                    <span className="font-medium text-dark-700">{formatMoney(venda.total)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide w-14">#</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Data</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Pagamento</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Total</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-12" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((venda) => (
                    <tr key={venda.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 font-mono text-xs">#{venda.numero}</td>
                      <td className="px-5 py-3 font-medium text-dark-700 max-w-[200px]">
                        <span className="block truncate">
                          {venda.cliente?.nome || <span className="text-dark-300 italic font-normal">Sem cliente</span>}
                        </span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(venda.data_venda)}</td>
                      <td className="hidden lg:table-cell px-5 py-3 text-dark-400">{FORMA_PAGAMENTO_LABEL[venda.forma_pagamento]}</td>
                      <td className="px-5 py-3 text-right font-medium text-dark-700">{formatMoney(venda.total)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={vendaStatusVariant(venda.status)}>
                          {VENDA_STATUS_LABEL[venda.status]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(venda)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir venda"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
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
        description={`Deseja excluir a venda #${confirmDelete?.numero}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={!!deletando}
      />

      <ModalNovaVenda
        open={modalNovaVenda}
        onClose={() => setModalNovaVenda(false)}
        onSuccess={() => { void loadVendas() }}
      />
    </div>
  )
}
