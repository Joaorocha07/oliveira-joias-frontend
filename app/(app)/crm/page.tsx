'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, SlidersHorizontal, Download } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import { PageHeader, Button, SearchInput, Spinner, EmptyState, Card } from '@/components/ui'
import { KanbanBoard } from '@/components/crm/kanban-board'
import { CrmFiltrosPanel, FILTROS_VAZIOS, contarFiltrosAtivos, type CrmFiltros } from '@/components/crm/crm-filtros'
import { ModalNovoLead } from '@/components/modals/modal-novo-lead'
import { ModalEditarLead } from '@/components/modals/modal-editar-lead'
import { ModalHistoricoCliente } from '@/components/modals/modal-historico-cliente'
import { ModalAgendarFollowUp } from '@/components/modals/modal-agendar-followup'
import { ModalWhatsApp } from '@/components/modals/modal-whatsapp'
import { listarLeadsFunil, updateStatusFunil, deleteLead } from '@/services/clientes'
import {
  exportarCsv, formatPhone, formatDate, formatMoney,
  STATUS_FUNIL_LABEL, STATUS_QUALIFICACAO_LABEL, PRODUTO_INTERESSE_LABEL,
} from '@/utils'
import type { Cliente, StatusFunil, OrigemCliente } from '@/types'

export default function CrmPage() {
  const { user } = useAuth()
  const alert = useAlert()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [novoLeadOpen, setNovoLeadOpen] = useState(false)
  const [detalheCliente, setDetalheCliente] = useState<Cliente | null>(null)
  const [agendarCliente, setAgendarCliente] = useState<Cliente | null>(null)
  const [whatsappCliente, setWhatsappCliente] = useState<Cliente | null>(null)
  const [editarCliente, setEditarCliente] = useState<Cliente | null>(null)
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [filtros, setFiltros] = useState<CrmFiltros>(FILTROS_VAZIOS)
  const [origens, setOrigens] = useState<OrigemCliente[]>([])
  const [vendedores, setVendedores] = useState<{ id: string; nome: string }[]>([])

  async function carregar() {
    setLoading(true)
    const { data, error } = await listarLeadsFunil()
    if (error) alert.error('Erro', 'Erro ao carregar o funil de leads.')
    else setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    supabase.from('origens_cliente').select('id, nome, ativo, created_at').eq('ativo', true).order('nome')
      .then(({ data }) => setOrigens((data as OrigemCliente[]) ?? []))
    supabase.from('profiles').select('id, nome').eq('ativo', true).in('role', ['vendedor', 'admin']).order('nome')
      .then(({ data }) => setVendedores(data ?? []))
  }, [])

  const filtrosAtivos = contarFiltrosAtivos(filtros)

  const filtrados = useMemo(() => {
    let result = clientes
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) => c.nome.toLowerCase().includes(q) || c.telefone?.includes(q))
    }
    if (filtros.cidade) {
      const q = filtros.cidade.toLowerCase()
      result = result.filter((c) => c.cidade?.toLowerCase().includes(q))
    }
    if (filtros.produtoInteresse) {
      result = result.filter((c) => c.produto_interesse === filtros.produtoInteresse)
    }
    if (filtros.origemId) {
      result = result.filter((c) => c.origem_id === filtros.origemId)
    }
    if (filtros.statusQualificacao) {
      result = result.filter((c) => c.status_qualificacao === filtros.statusQualificacao)
    }
    if (filtros.vendedorId) {
      result = result.filter((c) => c.vendedor_id === filtros.vendedorId)
    }
    if (filtros.valorMin !== null) {
      result = result.filter((c) => (c.valor_pretendido ?? 0) >= filtros.valorMin!)
    }
    if (filtros.valorMax !== null) {
      result = result.filter((c) => (c.valor_pretendido ?? 0) <= filtros.valorMax!)
    }
    if (filtros.dataCasamento) {
      result = result.filter((c) => c.data_casamento === filtros.dataCasamento)
    }
    return result
  }, [clientes, search, filtros])

  function handleExportarCsv() {
    exportarCsv(
      'leads-crm',
      ['Nome', 'Telefone', 'Cidade', 'Origem', 'Produto de Interesse', 'Status do Funil', 'Status de Atendimento', 'Vendedor', 'Valor Pretendido', 'Cadastrado em'],
      filtrados.map((c) => [
        c.nome,
        c.telefone ? formatPhone(c.telefone) : '',
        c.cidade ?? '',
        c.origem?.nome ?? c.origem_outro ?? '',
        c.produto_interesse ? PRODUTO_INTERESSE_LABEL[c.produto_interesse] : '',
        STATUS_FUNIL_LABEL[c.status_funil],
        STATUS_QUALIFICACAO_LABEL[c.status_qualificacao],
        c.vendedor?.nome ?? '',
        c.valor_pretendido ? formatMoney(c.valor_pretendido) : '',
        formatDate(c.created_at),
      ]),
    )
  }

  async function handleDeleteCliente(cliente: Cliente) {
    alert.warning(
      'Excluir cliente permanentemente',
      `Tem certeza que deseja excluir "${cliente.nome}"? Todos os dados vinculados a este cliente serão removidos permanentemente: vendas, crediário, serviços, histórico de atendimento e agendamentos. Esta ação não pode ser desfeita.`,
      {
        showCancel: true,
        confirmText: 'Excluir tudo',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          const { error } = await deleteLead(cliente.id)
          if (error) {
            alert.error('Erro ao excluir', error)
          } else {
            setClientes((prev) => prev.filter((c) => c.id !== cliente.id))
            alert.success('Excluído', `"${cliente.nome}" e todos os dados vinculados foram removidos.`)
          }
        },
      },
    )
  }

  async function handleMoveCard(clienteId: string, novoStatus: StatusFunil, statusAnterior: StatusFunil, motivoPerda?: string) {
    if (!user) return
    // Otimista: já reflete no board antes da resposta do servidor
    setClientes((prev) => prev.map((c) => c.id === clienteId ? { ...c, status_funil: novoStatus } : c))
    const { error } = await updateStatusFunil(clienteId, novoStatus, statusAnterior, user.id, motivoPerda)
    if (error) {
      alert.error('Erro', error)
      setClientes((prev) => prev.map((c) => c.id === clienteId ? { ...c, status_funil: statusAnterior } : c))
    }
  }

  return (
    <div>
      <PageHeader
        title="CRM · Funil de Vendas"
        subtitle="Acompanhe cada lead do primeiro contato até o pós-venda"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setNovoLeadOpen(true)}>
            Novo Lead
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou telefone..." className="w-full sm:max-w-sm" />
        <Button
          variant={filtrosAtivos > 0 ? 'primary' : 'secondary'}
          size="md"
          leftIcon={<SlidersHorizontal size={14} />}
          onClick={() => setFiltrosAbertos((v) => !v)}
        >
          Filtros{filtrosAtivos > 0 ? ` (${filtrosAtivos})` : ''}
        </Button>
        <Button variant="secondary" size="md" leftIcon={<Download size={14} />} onClick={handleExportarCsv} disabled={filtrados.length === 0}>
          Exportar
        </Button>
      </div>

      {filtrosAbertos && (
        <div className="mb-4">
          <CrmFiltrosPanel filtros={filtros} onChange={setFiltros} origens={origens} vendedores={vendedores} />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : filtrados.length === 0 ? (
        <Card>
          <EmptyState
            imageSrc="/images/Profile Interface-rafiki.svg"
            title="Nenhum lead encontrado"
            description={search || filtrosAtivos > 0 ? 'Tente outro termo ou ajuste os filtros.' : 'Adicione o primeiro lead ao funil.'}
            action={
              !search && filtrosAtivos === 0 && (
                <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={() => setNovoLeadOpen(true)}>
                  Novo Lead
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <KanbanBoard
          clientes={filtrados}
          onCardClick={setDetalheCliente}
          onMoveCard={handleMoveCard}
          onScheduleFollowUp={setAgendarCliente}
          onOpenWhatsApp={setWhatsappCliente}
          onEdit={setEditarCliente}
          onDelete={handleDeleteCliente}
        />
      )}

      <ModalNovoLead
        open={novoLeadOpen}
        onClose={() => setNovoLeadOpen(false)}
        onSuccess={carregar}
      />

      <ModalEditarLead
        open={!!editarCliente}
        onClose={() => setEditarCliente(null)}
        onSuccess={carregar}
        cliente={editarCliente}
      />

      <ModalHistoricoCliente
        open={!!detalheCliente}
        onClose={() => setDetalheCliente(null)}
        cliente={detalheCliente}
      />

      {agendarCliente && (
        <ModalAgendarFollowUp
          open={!!agendarCliente}
          onClose={() => setAgendarCliente(null)}
          onSuccess={() => {}}
          clienteId={agendarCliente.id}
          clienteNome={agendarCliente.nome}
        />
      )}

      {whatsappCliente && (
        <ModalWhatsApp
          open={!!whatsappCliente}
          onClose={() => setWhatsappCliente(null)}
          cliente={whatsappCliente}
        />
      )}
    </div>
  )
}
