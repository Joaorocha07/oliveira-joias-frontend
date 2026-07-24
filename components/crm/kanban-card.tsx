import { useDraggable } from '@dnd-kit/core'
import { Star, AtSign, CalendarClock, MessageCircle } from 'lucide-react'
import { Badge, ActionMenu } from '@/components/ui'
import { cn } from '@/lib/cn'
import { formatMoney, formatPhone, PRODUTO_INTERESSE_LABEL, STATUS_QUALIFICACAO_LABEL, STATUS_QUALIFICACAO_COR, getInitials } from '@/utils'
import type { Cliente } from '@/types'

interface Props {
  cliente: Cliente
  onClick: () => void
  onScheduleFollowUp: () => void
  onOpenWhatsApp: () => void
}

export function KanbanCard({ cliente, onClick, onScheduleFollowUp, onOpenWhatsApp }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cliente.id,
    data: { statusAtual: cliente.status_funil },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gold-100 p-3 cursor-grab active:cursor-grabbing',
        'hover:border-gold-200 hover:shadow-[0_2px_8px_rgba(45,36,24,0.08)] transition-shadow duration-150 touch-none',
        isDragging && 'opacity-30'
      )}
    >
      <KanbanCardContent cliente={cliente} onScheduleFollowUp={onScheduleFollowUp} onOpenWhatsApp={onOpenWhatsApp} />
    </div>
  )
}

/** Cópia estática renderizada dentro do `<DragOverlay>` — sem listeners/ref (não é um draggable). */
export function KanbanCardOverlay({ cliente }: { cliente: Cliente }) {
  return (
    <div className="w-64 bg-white rounded-lg border border-gold-300 p-3 shadow-[0_16px_40px_rgba(45,36,24,0.28)] rotate-[2deg] cursor-grabbing">
      <KanbanCardContent cliente={cliente} readOnly />
    </div>
  )
}

function KanbanCardContent({ cliente, onScheduleFollowUp, onOpenWhatsApp, readOnly }: {
  cliente: Cliente
  onScheduleFollowUp?: () => void
  onOpenWhatsApp?: () => void
  readOnly?: boolean
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-dark-700 leading-tight">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_QUALIFICACAO_COR[cliente.status_qualificacao] }}
            title={STATUS_QUALIFICACAO_LABEL[cliente.status_qualificacao]}
          />
          <span className="truncate">{cliente.nome}</span>
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={10}
                className={i < cliente.lead_score ? 'text-gold-500' : 'text-gold-100'}
                fill="currentColor"
              />
            ))}
          </div>
          {!readOnly && onScheduleFollowUp && onOpenWhatsApp && (
            <div onPointerDown={(e) => e.stopPropagation()}>
              <ActionMenu
                items={[
                  {
                    label: 'Agendar retorno',
                    icon: <CalendarClock size={14} />,
                    onClick: onScheduleFollowUp,
                  },
                  {
                    label: 'WhatsApp',
                    icon: <MessageCircle size={14} />,
                    onClick: onOpenWhatsApp,
                  },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {cliente.telefone && (
        <p className="text-xs text-dark-300 mt-1">{formatPhone(cliente.telefone)}</p>
      )}

      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {cliente.produto_interesse && (
          <Badge variant="gold" className="!px-2 !py-0.5 !text-[10px]">
            {PRODUTO_INTERESSE_LABEL[cliente.produto_interesse]}
          </Badge>
        )}
        {cliente.origem?.nome && (
          <Badge variant="gray" className="!px-2 !py-0.5 !text-[10px]">
            {cliente.origem.nome}
          </Badge>
        )}
        {cliente.instagram && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-dark-300">
            <AtSign size={10} /> {cliente.instagram}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50">
        {cliente.valor_pretendido ? (
          <span className="text-xs font-semibold text-dark-600">{formatMoney(cliente.valor_pretendido)}</span>
        ) : <span />}
        {cliente.vendedor?.nome && (
          <div
            className="w-5 h-5 rounded-full bg-gold-50 flex items-center justify-center text-[9px] font-semibold text-gold-600 flex-shrink-0"
            title={cliente.vendedor.nome}
          >
            {getInitials(cliente.vendedor.nome)}
          </div>
        )}
      </div>
    </>
  )
}
