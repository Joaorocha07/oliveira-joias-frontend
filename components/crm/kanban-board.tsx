'use client'

import { useMemo, useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter, useDroppable, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { Modal, Button, Textarea, Badge } from '@/components/ui'
import { STATUS_FUNIL_LABEL, STATUS_FUNIL_ORDEM, statusFunilVariant } from '@/utils'
import { KanbanCard, KanbanCardOverlay } from './kanban-card'
import type { Cliente, StatusFunil } from '@/types'

interface Props {
  clientes: Cliente[]
  onCardClick: (cliente: Cliente) => void
  onMoveCard: (clienteId: string, novoStatus: StatusFunil, statusAnterior: StatusFunil, motivoPerda?: string) => Promise<void>
  onScheduleFollowUp: (cliente: Cliente) => void
  onOpenWhatsApp: (cliente: Cliente) => void
}

function Column({ status, clientes, onCardClick, onScheduleFollowUp, onOpenWhatsApp }: {
  status: StatusFunil
  clientes: Cliente[]
  onCardClick: (cliente: Cliente) => void
  onScheduleFollowUp: (cliente: Cliente) => void
  onOpenWhatsApp: (cliente: Cliente) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <Badge variant={statusFunilVariant(status)} className="!px-2 !py-0.5">
            {STATUS_FUNIL_LABEL[status]}
          </Badge>
        </div>
        <span className="text-xs text-dark-300 font-medium">{clientes.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-xl p-2 space-y-2 transition-colors duration-150 ${
          isOver ? 'bg-gold-50/60 ring-2 ring-gold-200' : 'bg-cream-50/50'
        }`}
      >
        {clientes.map((cliente) => (
          <KanbanCard
            key={cliente.id}
            cliente={cliente}
            onClick={() => onCardClick(cliente)}
            onScheduleFollowUp={() => onScheduleFollowUp(cliente)}
            onOpenWhatsApp={() => onOpenWhatsApp(cliente)}
          />
        ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ clientes, onCardClick, onMoveCard, onScheduleFollowUp, onOpenWhatsApp }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [pendingPerda, setPendingPerda] = useState<{ clienteId: string; statusAnterior: StatusFunil } | null>(null)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [activeCliente, setActiveCliente] = useState<Cliente | null>(null)

  const colunas = useMemo(() => {
    const grupos = new Map<StatusFunil, Cliente[]>()
    STATUS_FUNIL_ORDEM.forEach((status) => grupos.set(status, []))
    clientes.forEach((cliente) => {
      grupos.get(cliente.status_funil)?.push(cliente)
    })
    return grupos
  }, [clientes])

  function handleDragStart(event: DragStartEvent) {
    setActiveCliente(clientes.find((c) => c.id === event.active.id) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveCliente(null)
    const { active, over } = event
    if (!over) return

    const clienteId = active.id as string
    const statusAnterior = active.data.current?.statusAtual as StatusFunil
    const novoStatus = over.id as StatusFunil
    if (novoStatus === statusAnterior) return

    if (novoStatus === 'lead_perdido') {
      setMotivoPerda('')
      setPendingPerda({ clienteId, statusAnterior })
      return
    }

    void onMoveCard(clienteId, novoStatus, statusAnterior)
  }

  async function confirmarPerda() {
    if (!pendingPerda) return
    setSalvando(true)
    await onMoveCard(pendingPerda.clienteId, 'lead_perdido', pendingPerda.statusAnterior, motivoPerda)
    setSalvando(false)
    setPendingPerda(null)
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCliente(null)}
      >
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STATUS_FUNIL_ORDEM.map((status) => (
            <Column
              key={status}
              status={status}
              clientes={colunas.get(status) ?? []}
              onCardClick={onCardClick}
              onScheduleFollowUp={onScheduleFollowUp}
              onOpenWhatsApp={onOpenWhatsApp}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeCliente && <KanbanCardOverlay cliente={activeCliente} />}
        </DragOverlay>
      </DndContext>

      <Modal
        open={!!pendingPerda}
        onClose={() => (!salvando ? setPendingPerda(null) : undefined)}
        title="Motivo da perda"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingPerda(null)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarPerda} loading={salvando}>
              Marcar como perdido
            </Button>
          </>
        }
      >
        <Textarea
          label="Por que este lead foi perdido?"
          value={motivoPerda}
          onChange={(e) => setMotivoPerda(e.target.value)}
          placeholder="Ex: escolheu outro fornecedor, sem resposta, preço..."
          autoFocus
        />
      </Modal>
    </>
  )
}
