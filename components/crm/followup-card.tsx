import { MessageCircle, Check, CalendarClock, X, Phone } from 'lucide-react'
import { Badge, Button } from '@/components/ui'
import { formatPhone, formatDateTime, PRODUTO_INTERESSE_LABEL } from '@/utils'
import type { ClienteFollowUp } from '@/types'

interface Props {
  followUp: ClienteFollowUp
  atrasado: boolean
  processing: boolean
  onConcluir: () => void
  onReagendar: () => void
  onCancelar: () => void
  onWhatsApp: () => void
}

export function FollowUpCard({ followUp, atrasado, processing, onConcluir, onReagendar, onCancelar, onWhatsApp }: Props) {
  const cliente = followUp.cliente

  return (
    <div className={`rounded-xl border p-4 ${atrasado ? 'border-red-200 bg-red-50/40' : 'border-gold-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-dark-700">{cliente?.nome ?? 'Cliente removido'}</p>
            {followUp.horario && (
              <Badge variant={atrasado ? 'danger' : 'gray'} className="!px-2 !py-0.5 !text-[10px]">
                {followUp.horario.slice(0, 5)}
              </Badge>
            )}
          </div>
          {cliente?.telefone && (
            <p className="flex items-center gap-1 text-xs text-dark-300 mt-0.5">
              <Phone size={11} /> {formatPhone(cliente.telefone)}
            </p>
          )}
        </div>
        {cliente?.vendedor?.nome && (
          <span className="text-xs text-dark-300 flex-shrink-0">{cliente.vendedor.nome}</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {cliente?.produto_interesse && (
          <Badge variant="gold" className="!px-2 !py-0.5 !text-[10px]">
            {PRODUTO_INTERESSE_LABEL[cliente.produto_interesse]}
          </Badge>
        )}
      </div>

      <p className="text-sm text-dark-600 mt-2 leading-snug">{followUp.motivo}</p>

      {cliente?.ultimo_contato_em && (
        <p className="text-xs text-dark-300 mt-1.5">
          Última conversa: {formatDateTime(cliente.ultimo_contato_em)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gold-50">
        {cliente?.telefone && (
          <button
            type="button"
            onClick={onWhatsApp}
            className="inline-flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-[#25D366]/10 text-[#128C4A] hover:bg-[#25D366]/20 transition-colors"
          >
            <MessageCircle size={13} /> WhatsApp
          </button>
        )}
        <Button variant="secondary" size="sm" leftIcon={<Check size={12} />} onClick={onConcluir} disabled={processing}>
          Concluir
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<CalendarClock size={12} />} onClick={onReagendar} disabled={processing}>
          Reagendar
        </Button>
        <Button variant="danger-ghost" size="sm" leftIcon={<X size={12} />} onClick={onCancelar} disabled={processing}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
