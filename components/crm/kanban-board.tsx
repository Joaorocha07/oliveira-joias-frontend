'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import {
  DndContext, DragOverlay, closestCenter, useDroppable, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronLeft, ChevronRight, GripHorizontal, X } from 'lucide-react'
import { Modal, Button, Textarea, Badge } from '@/components/ui'
import { STATUS_FUNIL_LABEL, STATUS_FUNIL_ORDEM, statusFunilVariant, STATUS_FUNIL_COR } from '@/utils'
import { cn } from '@/lib/cn'
import { KanbanCard, KanbanCardOverlay } from './kanban-card'
import type { Cliente, StatusFunil } from '@/types'

interface Props {
  clientes: Cliente[]
  onCardClick: (cliente: Cliente) => void
  onMoveCard: (clienteId: string, novoStatus: StatusFunil, statusAnterior: StatusFunil, motivoPerda?: string) => Promise<void>
  onScheduleFollowUp: (cliente: Cliente) => void
  onOpenWhatsApp: (cliente: Cliente) => void
  onEdit: (cliente: Cliente) => void
  onDelete: (cliente: Cliente) => void
}

function ColumnEmpty() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80px] rounded-xl border-2 border-dashed border-gold-100 py-5 gap-1">
      <p className="text-[11px] text-dark-300 font-medium">Nenhum lead aqui</p>
      <p className="text-[10px] text-dark-200">Arraste um card para esta etapa</p>
    </div>
  )
}

function Column({ status, clientes, onCardClick, onScheduleFollowUp, onOpenWhatsApp, onEdit, onDelete }: {
  status: StatusFunil
  clientes: Cliente[]
  onCardClick: (cliente: Cliente) => void
  onScheduleFollowUp: (cliente: Cliente) => void
  onOpenWhatsApp: (cliente: Cliente) => void
  onEdit: (cliente: Cliente) => void
  onDelete: (cliente: Cliente) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_FUNIL_COR[status] }}
          />
          <Badge variant={statusFunilVariant(status)} className="!px-2 !py-0.5">
            {STATUS_FUNIL_LABEL[status]}
          </Badge>
        </div>
        <span className="text-xs text-dark-300 font-medium">{clientes.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[120px] rounded-xl p-2 space-y-2',
          isOver ? 'bg-gold-50/60 ring-2 ring-gold-200' : 'bg-cream-50/50',
        )}
      >
        {clientes.length === 0 ? (
          <ColumnEmpty />
        ) : (
          clientes.map((cliente) => (
            <KanbanCard
              key={cliente.id}
              cliente={cliente}
              onClick={() => onCardClick(cliente)}
              onScheduleFollowUp={() => onScheduleFollowUp(cliente)}
              onOpenWhatsApp={() => onOpenWhatsApp(cliente)}
              onEdit={() => onEdit(cliente)}
              onDelete={() => onDelete(cliente)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Scrollbar customizado ──────────────────────────────────────────────────
interface CustomScrollbarProps {
  boardRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
}

function CustomScrollbar({ boardRef, onScroll }: CustomScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  // thumb em percentagem — independente da largura da track
  const [thumb, setThumb] = useState({ widthPct: 0, leftPct: 0 })
  const [visible, setVisible] = useState(false)
  const drag = useRef({ active: false, startX: 0, startScrollLeft: 0, thumbWidthPct: 0 })

  const update = useCallback(() => {
    const el = boardRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    if (scrollWidth <= clientWidth + 1) { setVisible(false); return }
    setVisible(true)
    const widthPct = Math.max(8, (clientWidth / scrollWidth) * 100)
    const maxScroll = scrollWidth - clientWidth
    const leftPct = maxScroll > 0 ? (scrollLeft / maxScroll) * (100 - widthPct) : 0
    setThumb({ widthPct, leftPct })
  }, [boardRef])

  useEffect(() => {
    const raf = requestAnimationFrame(update)
    const el = boardRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [boardRef, update])

  function handleThumbDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    drag.current = {
      active: true,
      startX: e.clientX,
      startScrollLeft: boardRef.current?.scrollLeft ?? 0,
      thumbWidthPct: thumb.widthPct,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handleThumbMove(e: React.PointerEvent) {
    if (!drag.current.active || !boardRef.current || !trackRef.current) return
    const trackW = trackRef.current.clientWidth
    const { scrollWidth, clientWidth } = boardRef.current
    const maxScroll = scrollWidth - clientWidth
    const thumbPx = trackW * drag.current.thumbWidthPct / 100
    const maxLeft = trackW - thumbPx
    if (maxLeft <= 0) return
    const dx = e.clientX - drag.current.startX
    boardRef.current.scrollLeft = Math.max(0, Math.min(maxScroll, drag.current.startScrollLeft + (dx / maxLeft) * maxScroll))
    onScroll()
  }

  function handleThumbUp() { drag.current.active = false }

  function handleTrackClick(e: React.MouseEvent<HTMLDivElement>) {
    if (drag.current.active || !boardRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const trackW = rect.width
    const clickX = e.clientX - rect.left
    const { scrollWidth, clientWidth } = boardRef.current
    const maxScroll = scrollWidth - clientWidth
    const thumbPx = trackW * thumb.widthPct / 100
    const maxLeft = trackW - thumbPx
    if (maxLeft <= 0) return
    boardRef.current.scrollLeft = Math.max(0, Math.min(maxScroll, ((clickX - thumbPx / 2) / maxLeft) * maxScroll))
    onScroll()
  }

  if (!visible) return null

  return (
    <div
      className="sticky bottom-0 z-10 pb-2 pt-1 flex justify-center"
      style={{ background: 'linear-gradient(to top, #FAF7F0 65%, transparent)' }}
    >
      <div
        ref={trackRef}
        className="h-2 w-48 rounded-full bg-gold-200 cursor-pointer relative overflow-hidden"
        onClick={handleTrackClick}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-gold-500"
          style={{ width: `${thumb.widthPct}%`, left: `${thumb.leftPct}%` }}
          onPointerDown={handleThumbDown}
          onPointerMove={handleThumbMove}
          onPointerUp={handleThumbUp}
          onPointerLeave={handleThumbUp}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}

// ── Board principal ─────────────────────────────────────────────────────────
export function KanbanBoard({ clientes, onCardClick, onMoveCard, onScheduleFollowUp, onOpenWhatsApp, onEdit, onDelete }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [pendingPerda, setPendingPerda] = useState<{ clienteId: string; statusAnterior: StatusFunil } | null>(null)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [activeCliente, setActiveCliente] = useState<Cliente | null>(null)
  const [showHint, setShowHint] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 5000)
    return () => clearTimeout(t)
  }, [])

  const updateArrows = useCallback(() => {
    if (!boardRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = boardRef.current
    setCanScrollLeft(scrollLeft > 0)
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1)
  }, [])

  useEffect(() => {
    updateArrows()
    window.addEventListener('resize', updateArrows)
    return () => window.removeEventListener('resize', updateArrows)
  }, [updateArrows])

  function scrollBy(amount: number) {
    boardRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  const colunas = useMemo(() => {
    const grupos = new Map<StatusFunil, Cliente[]>()
    STATUS_FUNIL_ORDEM.forEach((status) => grupos.set(status, []))
    clientes.forEach((cliente) => { grupos.get(cliente.status_funil)?.push(cliente) })
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
      {/* Dica animada */}
      {showHint && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gold-50/80 border border-gold-100 rounded-lg text-xs text-dark-400 select-none">
          <GripHorizontal size={14} className="text-gold-400 flex-shrink-0" />
          <span>Arraste horizontalmente ou use as setas para navegar entre as etapas</span>
          <button
            type="button"
            onClick={() => setShowHint(false)}
            className="ml-auto text-dark-300 hover:text-dark-500 flex-shrink-0 p-0.5 rounded transition-colors"
            aria-label="Fechar dica"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveCliente(null)}
      >
        <div className="relative group/board">
          {/* Seta esquerda */}
          <button
            type="button"
            aria-label="Rolar para esquerda"
            onClick={() => scrollBy(-280)}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8',
              'bg-white/95 rounded-full shadow-md border border-gold-100',
              'flex items-center justify-center text-gold-600',
              'opacity-0 group-hover/board:opacity-100',
              !canScrollLeft && '!opacity-0 pointer-events-none',
            )}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Colunas — scrollbar nativa oculta */}
          <div
            ref={boardRef}
            className="flex gap-3 overflow-x-auto select-none [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}
            onScroll={() => { updateArrows(); setShowHint(false) }}
          >
            {STATUS_FUNIL_ORDEM.map((status) => (
              <Column
                key={status}
                status={status}
                clientes={colunas.get(status) ?? []}
                onCardClick={onCardClick}
                onScheduleFollowUp={onScheduleFollowUp}
                onOpenWhatsApp={onOpenWhatsApp}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>

          {/* Seta direita */}
          <button
            type="button"
            aria-label="Rolar para direita"
            onClick={() => scrollBy(280)}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8',
              'bg-white/95 rounded-full shadow-md border border-gold-100',
              'flex items-center justify-center text-gold-600',
              'opacity-0 group-hover/board:opacity-100',
              !canScrollRight && '!opacity-0 pointer-events-none',
            )}
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Scrollbar dourada customizada — dentro do board, logo abaixo das colunas */}
        <CustomScrollbar
          boardRef={boardRef}
          onScroll={updateArrows}
        />

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
