'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Wrench, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, Button, SearchInput, Select, Spinner, EmptyState,
  ActionMenu, ConfirmDialog,
} from '@/components/ui'
import { ModalNovoServico } from '@/components/modals/modal-novo-servico'
import {
  formatMoney, formatDate, servicoStatusVariant, SERVICO_STATUS_LABEL,
} from '@/utils'
import { updateServicoStatus, deleteServico } from '@/services/servicos'
import type { ServicoComCliente, ServicoStatus } from '@/types'

const STATUS_OPTS: ServicoStatus[] = ['orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado']

export default function ServicosPage() {
  const [servicos, setServicos] = useState<ServicoComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<ServicoStatus | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ServicoComCliente | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ServicoComCliente | null>(null)
  const [deletando, setDeletando] = useState(false)

  const loadServicos = useCallback(async () => {
    const { data, error } = await supabase
      .from('servicos')
      .select('*, cliente:clientes(nome, telefone), responsavel:profiles!servicos_responsavel_id_fkey(nome)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar serviços.')
    } else {
      setServicos((data as ServicoComCliente[]) ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadServicos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadServicos])

  // Sequential display numbers — gap-free, based on DB numero order
  const displayNumMap = useMemo(() => {
    const sorted = [...servicos].sort((a, b) => a.numero - b.numero)
    return new Map(sorted.map((s, i) => [s.id, i + 1]))
  }, [servicos])

  const filtered = useMemo(() => {
    return servicos.filter((s) => {
      const matchSearch = !search ||
        s.tipo.toLowerCase().includes(search.toLowerCase()) ||
        s.cliente?.nome?.toLowerCase().includes(search.toLowerCase()) ||
        String(s.numero).includes(search)
      const matchStatus = !filtroStatus || s.status === filtroStatus
      return matchSearch && matchStatus
    })
  }, [servicos, search, filtroStatus])

  function openCreate() {
    setEditando(null)
    setModalOpen(true)
  }

  function openEdit(s: ServicoComCliente) {
    setEditando(s)
    setModalOpen(true)
  }

  async function handleStatusChange(id: string, status: ServicoStatus) {
    const { error } = await updateServicoStatus(id, status)
    if (error) {
      toast.error('Erro ao atualizar status.')
    } else {
      setServicos((prev) => prev.map((s) => s.id === id ? { ...s, status } : s))
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await deleteServico(confirmDelete.id)
    if (error) {
      toast.error('Erro ao excluir serviço.')
    } else {
      toast.success('Serviço excluído.')
      setServicos((prev) => prev.filter((s) => s.id !== confirmDelete.id))
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Ordens de serviço e reparos"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Serviço
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente, tipo ou nº..."
            className="flex-1"
          />
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as ServicoStatus | '')}
            placeholder="Todos os status"
            className="w-full sm:w-44"
          >
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>{SERVICO_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wrench size={24} />}
            title="Nenhum serviço encontrado"
            description={search || filtroStatus ? 'Tente ajustar os filtros.' : 'Nenhuma ordem de serviço registrada.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((s) => (
                <div key={s.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded flex-shrink-0">
                          #{displayNumMap.get(s.id)}
                        </span>
                        <p className="font-medium text-dark-700 text-sm truncate">
                          {s.cliente?.nome || <span className="text-dark-300 italic">Sem cliente</span>}
                        </p>
                      </div>
                      <p className="text-xs text-dark-500 mt-0.5 truncate">{s.tipo}</p>
                      <p className="text-xs text-dark-300 mt-0.5">
                        Entrada: {formatDate(s.data_entrada)}
                        {s.data_previsao && <> · Previsão: {formatDate(s.data_previsao)}</>}
                      </p>
                    </div>
                    <ActionMenu
                      items={[
                        { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(s) },
                        { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(s), variant: 'danger' },
                      ]}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50 gap-2">
                    <select
                      value={s.status}
                      onChange={(e) => void handleStatusChange(s.id, e.target.value as ServicoStatus)}
                      className="text-xs border border-gold-200 rounded-lg px-2 py-1 bg-white text-dark-600 focus:outline-none focus:ring-1 focus:ring-gold-400"
                    >
                      {STATUS_OPTS.map((opt) => (
                        <option key={opt} value={opt}>{SERVICO_STATUS_LABEL[opt]}</option>
                      ))}
                    </select>
                    <span className="font-medium text-dark-700">{formatMoney(s.valor)}</span>
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
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Tipo</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Entrada</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Previsão</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 font-mono text-xs">#{displayNumMap.get(s.id)}</td>
                      <td className="px-5 py-3 font-medium text-dark-700 max-w-[160px]">
                        <span className="block truncate">
                          {s.cliente?.nome || <span className="text-dark-300 italic font-normal">Sem cliente</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-dark-600 max-w-[160px]">
                        <span className="block truncate">{s.tipo}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(s.data_entrada)}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(s.data_previsao)}</td>
                      <td className="px-5 py-3 text-right font-medium text-dark-700">{formatMoney(s.valor)}</td>
                      <td className="px-5 py-3">
                        <select
                          value={s.status}
                          onChange={(e) => void handleStatusChange(s.id, e.target.value as ServicoStatus)}
                          className="text-xs border border-gold-200 rounded-lg px-2 py-1 bg-white text-dark-600 focus:outline-none focus:ring-1 focus:ring-gold-400 cursor-pointer"
                        >
                          {STATUS_OPTS.map((opt) => (
                            <option key={opt} value={opt}>{SERVICO_STATUS_LABEL[opt]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar serviço"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(s)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Excluir serviço"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <ModalNovoServico
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null) }}
        onSuccess={() => { void loadServicos() }}
        servico={editando}
        displayNum={editando ? displayNumMap.get(editando.id) : undefined}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir serviço"
        description={`Deseja excluir o serviço #${confirmDelete ? displayNumMap.get(confirmDelete.id) : ''}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </div>
  )
}
