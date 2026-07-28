'use client'

import { useDraggable } from '@dnd-kit/core'
import { Star, AtSign, CalendarClock, MessageCircle, Pencil, Trash2, Flame, Clock } from 'lucide-react'
import { Badge, ActionMenu } from '@/components/ui'
import { cn } from '@/lib/cn'
import {
  formatMoney, formatPhone, formatRelativeTime,
  PRODUTO_INTERESSE_LABEL, STATUS_QUALIFICACAO_LABEL, STATUS_QUALIFICACAO_COR,
  STATUS_FUNIL_COR, STATUS_FUNIL_ORDEM,
  getInitials,
} from '@/utils'
import type { Cliente } from '@/types'

interface Props {
  cliente: Cliente
  onClick: () => void
  onScheduleFollowUp: () => void
  onOpenWhatsApp: () => void
  onEdit: () => void
  onDelete: () => void
}

const funilProgress = (status: Cliente['status_funil']) =>
  ((STATUS_FUNIL_ORDEM.indexOf(status) + 1) / STATUS_FUNIL_ORDEM.length) * 100

export function KanbanCard({ cliente, onClick, onScheduleFollowUp, onOpenWhatsApp, onEdit, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cliente.id,
    data: { statusAtual: cliente.status_funil },
  })

  return (
    <div
      ref={setNodeRef}
      data-dnd-card
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        'relative bg-white rounded-lg border border-gold-100 border-l-[3px] border-l-transparent p-3',
        'cursor-grab active:cursor-grabbing touch-none',
        'hover:border-l-gold-300',
        isDragging && 'opacity-30'
      )}
    >
      {/* Barra de progresso — overflow-hidden aqui não afeta o dropdown do ActionMenu */}
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-tl-lg rounded-tr-lg overflow-hidden bg-gold-50">
        <div
          className="h-full"
          style={{
            width: `${funilProgress(cliente.status_funil)}%`,
            backgroundColor: STATUS_FUNIL_COR[cliente.status_funil],
          }}
        />
      </div>

      <KanbanCardContent
        cliente={cliente}
        onScheduleFollowUp={onScheduleFollowUp}
        onOpenWhatsApp={onOpenWhatsApp}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

export function KanbanCardOverlay({ cliente }: { cliente: Cliente }) {
  return (
    <div className="w-64 bg-white rounded-lg border border-gold-300 border-l-[3px] border-l-gold-400 p-3 shadow-[0_16px_40px_rgba(45,36,24,0.28)] rotate-[2deg] cursor-grabbing relative">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-tl-lg rounded-tr-lg overflow-hidden bg-gold-50">
        <div
          className="h-full"
          style={{
            width: `${funilProgress(cliente.status_funil)}%`,
            backgroundColor: STATUS_FUNIL_COR[cliente.status_funil],
          }}
        />
      </div>
      <KanbanCardContent cliente={cliente} readOnly />
    </div>
  )
}

function KanbanCardContent({
  cliente, onScheduleFollowUp, onOpenWhatsApp, onEdit, onDelete, readOnly,
}: {
  cliente: Cliente
  onScheduleFollowUp?: () => void
  onOpenWhatsApp?: () => void
  onEdit?: () => void
  onDelete?: () => void
  readOnly?: boolean
}) {
  const relTime = formatRelativeTime(cliente.ultimo_contato_em)

  return (
    <>
      {/* Cabeçalho: nome + estrelas + menu */}
      <div className="flex items-start justify-between gap-2 mt-0.5">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-dark-700 leading-tight">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: STATUS_QUALIFICACAO_COR[cliente.status_qualificacao] }}
            title={STATUS_QUALIFICACAO_LABEL[cliente.status_qualificacao]}
          />
          <span className="truncate">{cliente.nome}</span>
          {cliente.lead_score === 5 && (
            <span title="Prioridade máxima"><Flame size={12} className="text-orange-400 flex-shrink-0" /></span>
          )}
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
          {!readOnly && onScheduleFollowUp && onOpenWhatsApp && onEdit && onDelete && (
            <div onPointerDown={(e) => e.stopPropagation()}>
              <ActionMenu
                items={[
                  { label: 'Agendar retorno', icon: <CalendarClock size={14} />, onClick: onScheduleFollowUp },
                  { label: 'WhatsApp', icon: <MessageCircle size={14} />, onClick: onOpenWhatsApp },
                  { label: 'Editar', icon: <Pencil size={14} />, onClick: onEdit },
                  { label: 'Excluir', icon: <Trash2 size={14} />, onClick: onDelete, variant: 'danger' },
                ]}
              />
            </div>
          )}
        </div>
      </div>

      {/* Telefone em fonte monoespaçada */}
      {cliente.telefone && (
        <p className="font-mono text-xs text-dark-300 mt-1 tracking-tight">
          {formatPhone(cliente.telefone)}
        </p>
      )}

      {/* Tags: produto, origem, instagram */}
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
            <AtSign size={10} />
            {cliente.instagram}
          </span>
        )}
      </div>

      {/* Rodapé: valor + último contato + vendedor */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gold-50">
        <div className="flex items-center gap-1.5 min-w-0">
          {cliente.valor_pretendido ? (
            <span className="text-xs font-semibold text-dark-700">
              {formatMoney(cliente.valor_pretendido)}
            </span>
          ) : (
            <span />
          )}
          {relTime && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-dark-300 bg-cream-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
              <Clock size={8} />
              {relTime}
            </span>
          )}
        </div>

        {cliente.vendedor?.nome && (
          <div
            className="w-5 h-5 rounded-full bg-gold-100 flex items-center justify-center text-[9px] font-bold text-gold-700 flex-shrink-0 ring-1 ring-gold-200"
            title={cliente.vendedor.nome}
          >
            {getInitials(cliente.vendedor.nome)}
          </div>
        )}
      </div>
    </>
  )
}
