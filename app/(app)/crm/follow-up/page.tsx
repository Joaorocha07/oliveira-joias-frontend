'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock, Users, FileWarning } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { PageHeader, Card, Spinner, EmptyState } from '@/components/ui'
import { FollowUpCard } from '@/components/crm/followup-card'
import { ModalAgendarFollowUp } from '@/components/modals/modal-agendar-followup'
import { ModalConcluirFollowUp } from '@/components/modals/modal-concluir-followup'
import { ModalWhatsApp } from '@/components/modals/modal-whatsapp'
import {
  listarFollowUps, listarAlertas, cancelarFollowUp,
  type AlertasFunil,
} from '@/services/follow-ups'
import { today } from '@/utils'
import type { ClienteFollowUp } from '@/types'

export default function FollowUpPage() {
  const { user, profile } = useAuth()
  const alert = useAlert()
  const [followUps, setFollowUps] = useState<ClienteFollowUp[]>([])
  const [alertas, setAlertas] = useState<AlertasFunil | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reagendando, setReagendando] = useState<ClienteFollowUp | null>(null)
  const [concluindo, setConcluindo] = useState<ClienteFollowUp | null>(null)
  const [whatsappFollowUp, setWhatsappFollowUp] = useState<ClienteFollowUp | null>(null)

  const escopoVendedor = profile?.role === 'vendedor' ? profile.id : undefined

  async function carregar() {
    setLoading(true)
    const [followUpsRes, alertasRes] = await Promise.all([
      listarFollowUps(),
      listarAlertas(escopoVendedor),
    ])
    if (followUpsRes.error) alert.error('Erro', 'Erro ao carregar a agenda de follow-up.')
    else setFollowUps(followUpsRes.data ?? [])
    if (!alertasRes.error) setAlertas(alertasRes.data)
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [escopoVendedor])

  const { atrasados, hoje, proximos } = useMemo(() => {
    const hojeStr = today()
    return {
      atrasados: followUps.filter((f) => f.data_agendada < hojeStr),
      hoje: followUps.filter((f) => f.data_agendada === hojeStr),
      proximos: followUps.filter((f) => f.data_agendada > hojeStr),
    }
  }, [followUps])

  async function handleCancelar(followUp: ClienteFollowUp) {
    if (!user) return
    setProcessingId(followUp.id)
    const { error } = await cancelarFollowUp(followUp, user.id)
    if (error) alert.error('Erro', error)
    else await carregar()
    setProcessingId(null)
  }

  const totalHojeEAtrasados = atrasados.length + hoje.length

  return (
    <div>
      <PageHeader
        title="CRM · Follow-up"
        subtitle={
          totalHojeEAtrasados > 0
            ? `🔔 Você possui ${totalHojeEAtrasados} follow-up${totalHojeEAtrasados !== 1 ? 's' : ''} para hoje ou atrasado(s)`
            : 'Nenhum follow-up pendente para hoje'
        }
      />

      {alertas && (
        alertas.semRespostaCount + alertas.esquecidosCount + alertas.orcamentoSemRetornoCount + alertas.followUpsVencidosCount > 0
      ) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <AlertaTile
            icon={<Clock size={16} />}
            label="Sem resposta 24h"
            count={alertas.semRespostaCount}
          />
          <AlertaTile
            icon={<Users size={16} />}
            label="Clientes esquecidos (7d+)"
            count={alertas.esquecidosCount}
          />
          <AlertaTile
            icon={<FileWarning size={16} />}
            label="Orçamentos sem retorno"
            count={alertas.orcamentoSemRetornoCount}
          />
          <AlertaTile
            icon={<AlertTriangle size={16} />}
            label="Follow-ups vencidos"
            count={alertas.followUpsVencidosCount}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : followUps.length === 0 ? (
        <Card>
          <EmptyState
            imageSrc="/images/No data-cuate.svg"
            title="Nenhum follow-up agendado"
            description="Agende retornos a partir do Kanban ou da Timeline de um cliente."
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <FollowUpSection
            title="Atrasados"
            items={atrasados}
            atrasado
            processingId={processingId}
            onConcluir={setConcluindo}
            onReagendar={setReagendando}
            onCancelar={handleCancelar}
            onWhatsApp={setWhatsappFollowUp}
          />
          <FollowUpSection
            title="Hoje"
            items={hoje}
            processingId={processingId}
            onConcluir={setConcluindo}
            onReagendar={setReagendando}
            onCancelar={handleCancelar}
            onWhatsApp={setWhatsappFollowUp}
          />
          <FollowUpSection
            title="Próximos"
            items={proximos}
            processingId={processingId}
            onConcluir={setConcluindo}
            onReagendar={setReagendando}
            onCancelar={handleCancelar}
            onWhatsApp={setWhatsappFollowUp}
          />
        </div>
      )}

      {reagendando && (
        <ModalAgendarFollowUp
          open={!!reagendando}
          onClose={() => setReagendando(null)}
          onSuccess={carregar}
          clienteId={reagendando.cliente_id}
          clienteNome={reagendando.cliente?.nome}
          followUp={reagendando}
        />
      )}

      {whatsappFollowUp?.cliente && (
        <ModalWhatsApp
          open={!!whatsappFollowUp}
          onClose={() => setWhatsappFollowUp(null)}
          cliente={whatsappFollowUp.cliente}
        />
      )}

      {concluindo && user && (
        <ModalConcluirFollowUp
          open={!!concluindo}
          onClose={() => setConcluindo(null)}
          onSuccess={carregar}
          followUp={concluindo}
          userId={user.id}
        />
      )}
    </div>
  )
}

function AlertaTile({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className={`rounded-xl border p-3.5 flex items-center gap-3 ${count > 0 ? 'border-red-200 bg-red-50/40' : 'border-gold-100 bg-white'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${count > 0 ? 'bg-red-100 text-red-600' : 'bg-cream-100 text-dark-300'}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className={`text-lg font-display font-semibold leading-none ${count > 0 ? 'text-red-600' : 'text-dark-500'}`}>{count}</p>
        <p className="text-[11px] text-dark-400 mt-1 leading-tight">{label}</p>
      </div>
    </div>
  )
}

function FollowUpSection({ title, items, atrasado, processingId, onConcluir, onReagendar, onCancelar, onWhatsApp }: {
  title: string
  items: ClienteFollowUp[]
  atrasado?: boolean
  processingId: string | null
  onConcluir: (f: ClienteFollowUp) => void
  onReagendar: (f: ClienteFollowUp) => void
  onCancelar: (f: ClienteFollowUp) => void
  onWhatsApp: (f: ClienteFollowUp) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-dark-400 mb-2.5">
        {title} <span className="text-dark-300 font-normal">({items.length})</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((followUp) => (
          <FollowUpCard
            key={followUp.id}
            followUp={followUp}
            atrasado={!!atrasado}
            processing={processingId === followUp.id}
            onConcluir={() => onConcluir(followUp)}
            onReagendar={() => onReagendar(followUp)}
            onCancelar={() => onCancelar(followUp)}
            onWhatsApp={() => onWhatsApp(followUp)}
          />
        ))}
      </div>
    </div>
  )
}
