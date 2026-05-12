'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Wrench } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, Button, SearchInput, Select, Spinner, EmptyState,
} from '@/components/ui'
import { ModalNovoServico } from '@/components/modals/modal-novo-servico'
import {
  formatMoney, formatDate, servicoStatusVariant, SERVICO_STATUS_LABEL,
} from '@/utils'
import type { ServicoComCliente, ServicoStatus } from '@/types'

export default function ServicosPage() {
  const [servicos, setServicos] = useState<ServicoComCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<ServicoStatus | ''>('')
  const [modalNovoServico, setModalNovoServico] = useState(false)

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

  return (
    <div>
      <PageHeader
        title="Serviços"
        subtitle="Ordens de serviço e reparos"
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => setModalNovoServico(true)}
          >
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
            {(Object.keys(SERVICO_STATUS_LABEL) as ServicoStatus[]).map((s) => (
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
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded flex-shrink-0">
                      #{s.numero}
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
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50">
                    <Badge variant={servicoStatusVariant(s.status)}>{SERVICO_STATUS_LABEL[s.status]}</Badge>
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 font-mono text-xs">#{s.numero}</td>
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
                        <Badge variant={servicoStatusVariant(s.status)}>
                          {SERVICO_STATUS_LABEL[s.status]}
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

      <ModalNovoServico
        open={modalNovoServico}
        onClose={() => setModalNovoServico(false)}
        onSuccess={() => { void loadServicos() }}
      />
    </div>
  )
}
